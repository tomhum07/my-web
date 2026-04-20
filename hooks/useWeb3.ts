"use client";

import { BrowserProvider, JsonRpcSigner } from "ethers";
import { useCallback, useState } from "react";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type Web3State = {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  userAddress: string | null;
  error: string | null;
  connectWallet: () => Promise<void>;
};

type ConnectedWallet = {
  provider: BrowserProvider;
  signer: JsonRpcSigner;
  address: string;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export async function connectMetaMask(): Promise<ConnectedWallet> {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}

export function useWeb3(): Web3State {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    try {
      setError(null);

      const connectedWallet = await connectMetaMask();

      setProvider(connectedWallet.provider);
      setSigner(connectedWallet.signer);
      setUserAddress(connectedWallet.address);
    } catch {
      setError("Failed to connect wallet. Please try again.");
    }
  }, []);

  return {
    provider,
    signer,
    userAddress,
    error,
    connectWallet,
  };
}
