import { ethers } from "ethers";
import SafeSingletonFactory from "../test/hardhat/utils/SafeSingletonFactory";
import {
  SimulateTxAccessor__factory,
  SafeProxyFactory__factory,
  TokenCallbackHandler__factory,
  CompatibilityFallbackHandler__factory,
  CreateCall__factory,
  MultiSend__factory,
  MultiSendCallOnly__factory,
  SignMessageLib__factory,
  SafeL2__factory,
  Safe__factory,
  EntryPoint__factory,
} from "../typechain-types";
import makeDevFaster from "../test/hardhat/utils/makeDevFaster";

async function deploy() {
  const contractFactories = [
    SimulateTxAccessor__factory,
    SafeProxyFactory__factory,
    TokenCallbackHandler__factory,
    CompatibilityFallbackHandler__factory,
    CreateCall__factory,
    EntryPoint__factory,
    MultiSend__factory,
    MultiSendCallOnly__factory,
    SignMessageLib__factory,
    SafeL2__factory,
    Safe__factory,
  ];

  const { NODE_URL, MNEMONIC } = process.env;
  const provider = new ethers.JsonRpcProvider(NODE_URL);
  await makeDevFaster(provider);
  const hdNode = ethers.HDNodeWallet.fromPhrase(MNEMONIC!);
  const wallet = new ethers.Wallet(hdNode.privateKey, provider);

  const safeSingletonFactory = await SafeSingletonFactory.init(wallet);
  for (const contractFactory of contractFactories) {
    const contract = await safeSingletonFactory.connectOrDeploy(
      contractFactory,
      [],
    );

    const contractName = contractFactory.name.split("_")[0];
    console.log(`deployed ${contractName} to ${await contract.getAddress()}`);
  }
}

deploy().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});
