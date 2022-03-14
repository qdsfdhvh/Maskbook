import { EthereumAddress } from 'wallet.ts'
import { toHex } from 'web3-utils'
import { EthereumMethodType, ProviderType } from '@masknet/web3-shared-evm'
import type { Context, Middleware } from '../types'
import { getTransactionCount } from '../network'
import { currentMaskWalletChainIdSettings } from '../../../../plugins/Wallet/settings'

class NonceManager {
    constructor(private address: string) {}
    private nonce = NonceManager.INITIAL_NONCE
    private locked = false
    private tasks: (() => void)[] = []

    private lock() {
        this.locked = true
    }
    private unlock() {
        this.locked = false
    }
    private continue() {
        if (!this.locked) this.tasks.shift()?.()
    }
    private async getRemoteNonce() {
        return new Promise<number>(async (resolve, reject) => {
            const callback = (error: Error | null, nonce = 0) => {
                if (error) reject(error)
                else resolve(nonce)
                this.unlock()
                this.continue()
            }
            const run = async () => {
                try {
                    this.lock()
                    callback(
                        null,
                        await getTransactionCount(this.address, {
                            // Only mask wallets need to use Nonce
                            providerType: ProviderType.MaskWallet,
                            chainId: currentMaskWalletChainIdSettings.value,
                        }),
                    )
                } catch (error: unknown) {
                    callback(error instanceof Error ? error : new Error('Failed to get remote nonce.'))
                }
            }
            if (this.locked) this.tasks.push(run)
            else run()
        })
    }

    public async getNonce() {
        const nonce = Math.max(await this.getRemoteNonce(), this.nonce)
        await this.setNonce(nonce)
        return nonce
    }

    public async setNonce(nonce: number) {
        return new Promise<void>(async (resolve, reject) => {
            const callback = (e: Error | null) => {
                if (e) reject(e)
                else resolve()
                this.unlock()
                this.continue()
            }
            const run = async () => {
                this.lock()
                this.nonce = nonce
                callback(null)
            }
            if (this.locked) this.tasks.push(run)
            else run()
        })
    }

    public async resetNonce() {
        const nonce = await this.getRemoteNonce()
        await this.setNonce(nonce)
    }

    static INITIAL_NONCE = -1
}

export class Nonce implements Middleware<Context> {
    private cache = new Map<string, NonceManager>()

    constructor() {
        // reset all nonce if the chain id of mask wallet was changed
        currentMaskWalletChainIdSettings.addListener(() => {
            this.resetAllNonce()
        })
    }

    private getManager(address: string) {
        const address_ = EthereumAddress.checksumAddress(address)
        if (!this.cache.has(address_)) this.cache.set(address_, new NonceManager(address_))
        return this.cache.get(address_)!
    }

    private getNonce(address: string) {
        return this.getManager(address).getNonce()
    }

    private async commitNonce(address: string) {
        const manager = this.getManager(address)
        return manager.setNonce((await manager.getNonce()) + 1)
    }

    private resetNonce(address: string) {
        const manager = this.getManager(address)
        return manager.resetNonce()
    }

    private async resetAllNonce() {
        await Promise.all(Array.from(this.cache.values()).map((m) => m.resetNonce()))
    }

    async fn(context: Context, next: () => Promise<void>) {
        // set a nonce for Mask wallets
        if (
            context.account &&
            context.providerType === ProviderType.MaskWallet &&
            context.method === EthereumMethodType.ETH_SEND_TRANSACTION
        ) {
            context.requestArguments = {
                method: context.method,
                params: [
                    {
                        ...context.config,
                        nonce: toHex(await this.getNonce(context.account)),
                    },
                ],
            }
        }

        await next()

        if (context.method !== EthereumMethodType.ETH_SEND_TRANSACTION) return

        try {
            const message = context.error?.message ?? ''
            const isGeneralErrorNonce = /\bnonce|transaction\b/im.test(message) && /\b(low|high|old)\b/im.test(message)
            const isAuroraErrorNonce = message.includes('ERR_INCORRECT_NONCE')

            // if a transaction hash was received then commit the nonce
            if (isGeneralErrorNonce || isAuroraErrorNonce) await this.resetNonce(context.account)
            // else if a nonce error was occurred then reset the nonce
            else if (!context.error && typeof context.result === 'string') await this.commitNonce(context.account)
        } catch {
            // to scan the context to determine how to update the local nonce, allow to fail silently
        }
    }
}