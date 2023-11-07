import { ethers, NonceManager } from "ethers";
import {
  SafeProxyFactory__factory,
  Safe__factory,
} from "../../../typechain-types";
import SafeSingletonFactory from "./SafeSingletonFactory";
import receiptOf from "./receiptOf";
import makeDevFaster from "./makeDevFaster";

export async function setupTests() {
  const { BUNDLER_URL, NODE_URL, MNEMONIC } = process.env;

  if (!BUNDLER_URL) {
    throw new Error(
      "missing bundler env var BUNDLER_URL. Make sure you have copied or created a .env file",
    );
  }
  if (!NODE_URL) {
    throw new Error(
      "missing bundler env var NODE_URL. Make sure you have copied or created a .env file",
    );
  }
  if (!MNEMONIC) {
    throw new Error(
      "missing bundler env var MNEMONIC. Make sure you have copied or created a .env file",
    );
  }

  const bundlerProvider = new ethers.JsonRpcProvider(BUNDLER_URL);
  const provider = new ethers.JsonRpcProvider(NODE_URL);
  await makeDevFaster(provider);

  const admin = new NonceManager(
    ethers.Wallet.fromPhrase(MNEMONIC).connect(provider),
  );
  const owner = ethers.Wallet.createRandom(provider);

  await receiptOf(
    await admin.sendTransaction({
      to: owner.address,
      value: ethers.parseEther("1"),
    }),
  );

  const entryPoints = (await bundlerProvider.send(
    "eth_supportedEntryPoints",
    [],
  )) as string[];

  if (entryPoints.length === 0) {
    throw new Error("No entry points found");
  }

  const entryPointAddress = entryPoints[0];

  const ssf = await SafeSingletonFactory.init(admin);

  const safeProxyFactory = await ssf.connectOrDeploy(
    SafeProxyFactory__factory,
    [],
  );
  const safeSingleton = await ssf.connectOrDeploy(Safe__factory, []);

  return {
    bundlerProvider,
    provider,
    admin,
    owner,
    entryPointAddress,
    safeProxyFactory,
    safeSingleton,
  };
}
