import { ethers } from 'ethers';
import { z } from 'zod';
import {
  SafeCompressionPlugin,
  SafeCompressionPlugin__factory,
  SafeCompressionFactory,
} from '../../../../demos/inpage/hardhat/typechain-types';
import EthereumRpc from '../EthereumRpc';
import IAccount from './IAccount';
// import WaxInPage from '..';
import receiptOf from '../helpers/receiptOf';
import {
  encodeBitStack,
  encodePseudoFloat,
  encodeRegIndex,
  encodeVLQ,
  hexJoin,
  hexLen,
} from '../helpers/encodeUtils';
import getContracts from './getContracts';

export const SafeCompressionAccountData = z.object({
  type: z.literal('SafeCompressionAccount'),
  address: z.string(),
  privateKey: z.string(),
  ownerAddress: z.string(),
});

export type SafeCompressionAccountData = z.infer<
  typeof SafeCompressionAccountData
>;

// Cost of validating a signature or whatever verification method is in place.
const baseVerificationGas = 100_000n;

export default class SafeCompressionAccountWrapper implements IAccount {
  type = 'SafeCompressionAccount';

  constructor(
    public address: string,
    public privateKey: string,
    public ownerAddress: string,
    public provider: ethers.BrowserProvider,
  ) {}

  static fromData(data: SafeCompressionAccountData, provider: ethers.BrowserProvider) {
    return new SafeCompressionAccountWrapper(
      data.address,
      data.privateKey,
      data.ownerAddress,
      provider,
    );
  }

  toData(): SafeCompressionAccountData {
    return {
      type: 'SafeCompressionAccount',
      address: this.address,
      privateKey: this.privateKey,
      ownerAddress: this.ownerAddress,
    };
  }

  static async createRandom(
    // TODO: clean up parameters needed for getContracts
    provider: ethers.BrowserProvider,
    admin: ethers.Signer
  ): Promise<SafeCompressionAccountWrapper> {
    const contracts = await getContracts(
      provider,
      admin
    );

    const wallet = ethers.Wallet.createRandom();

    const createArgs = [
      contracts.safe,
      contracts.entryPoint,
      contracts.fallbackDecompressor,
      wallet,
      0,
    ] satisfies Parameters<SafeCompressionFactory['create']>;

    const address = await contracts.safeCompressionFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(
      contracts.safeCompressionFactory.connect(admin).create(...createArgs),
    );

    return new SafeCompressionAccountWrapper(
      address,
      wallet.privateKey,
      wallet.address,
      provider,
    );
  }

  getContract(): SafeCompressionPlugin {
    return SafeCompressionPlugin__factory.connect(
      this.address,
      this.provider,
    );
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  async makeInitCode(): Promise<string> {
    throw new Error(
      [
        'SafeCompressionAccount does not use initCode (it must be created',
        'before use)',
      ].join(' '),
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  async encodeActions(actions: EthereumRpc.Action[]): Promise<string> {
    let stream = '0x';
    const bits: boolean[] = [];

    for (const action of actions) {
      const addressIndex: bigint | undefined = undefined;

      // TODO: Find addressIndex using event logs (see issue #122)

      bits.push(addressIndex !== undefined);

      let toBytes;

      if (addressIndex !== undefined) {
        toBytes = encodeRegIndex(addressIndex);
      } else {
        toBytes = action.to;
      }

      stream = hexJoin([
        stream,
        toBytes,
        encodePseudoFloat(BigInt(action.value ?? 0)),
        encodeVLQ(BigInt(hexLen(action.data ?? '0x'))),
        action.data ?? '0x',
      ]);
    }

    stream = hexJoin([
      encodeVLQ(BigInt(actions.length)),
      encodeBitStack(bits),
      stream,
    ]);

    // this.waxInPage.logBytes('stream argument of decompressAndPerform', stream);

    return SafeCompressionPlugin__factory.createInterface().encodeFunctionData(
      'decompressAndPerform',
      [stream],
    );
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  async estimateVerificationGas(
    _userOp: EthereumRpc.UserOperation,
  ): Promise<bigint> {
    // TODO: estimateGas on validateUserOp?
    return baseVerificationGas;
  }

  async getNonce(): Promise<bigint> {
    const contracts = await getContracts(this.provider);

    // TODO: Why does this give a different result to
    // this.getContract().getNonce()?
    // (And why does that alternative give the wrong answer?)
    return await contracts.entryPoint.getNonce(this.address, 0);
  }

  async sign(
    _userOp: EthereumRpc.UserOperation,
    userOpHash: string,
  ): Promise<string> {
    const ownerWallet = new ethers.Wallet(this.privateKey);

    return await ownerWallet.signMessage(ethers.getBytes(userOpHash));
  }
}
