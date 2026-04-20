"use client";

import { Contract, isAddress } from "ethers";
import type { JsonRpcSigner } from "ethers";
import { useCallback, useState } from "react";

import certificateAbi from "@/constants/abi.json";
import { CERTIFICATE_CONTRACT_ADDRESS } from "@/constants/address";

type IssueCertificateResult = {
  issueCertificate: (
    hash: string,
    studentWallet: string,
    signer: JsonRpcSigner | null
  ) => Promise<string | null>;
  isIssuing: boolean;
  error: string | null;
};

export function useIssueCertificate(): IssueCertificateResult {
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issueCertificate = useCallback(
    async (hash: string, studentWallet: string, signer: JsonRpcSigner | null) => {
      try {
        setError(null);

        if (!signer) {
          throw new Error("Wallet is not connected.");
        }

        if (!hash.trim()) {
          throw new Error("Certificate hash is required.");
        }

        if (!isAddress(studentWallet)) {
          throw new Error("Student wallet address is invalid.");
        }

        setIsIssuing(true);

        const contract = new Contract(
          CERTIFICATE_CONTRACT_ADDRESS,
          certificateAbi,
          signer
        );
        const tx = await contract.issueCertificate(hash, studentWallet);
        const receipt = await tx.wait();

        return receipt?.hash ?? tx.hash ?? null;
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to issue certificate.";
        setError(message);
        return null;
      } finally {
        setIsIssuing(false);
      }
    },
    []
  );

  return {
    issueCertificate,
    isIssuing,
    error,
  };
}
