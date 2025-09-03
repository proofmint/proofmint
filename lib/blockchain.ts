import algosdk from "algosdk";
import {
  algodClient,
  ADMIN_WALLET,
  OPERATIONAL_WALLET,
  ONBOARDING_WALLET,
} from "./const";
import { signTransactions } from "./vault";

export const getDetailedBalances = async (address: string) => {
  const r = await algodClient.accountInformation(address).do();
  const balance = algosdk.microalgosToAlgos(
    Number(r.amountWithoutPendingRewards)
  );
  const minBalance = algosdk.microalgosToAlgos(Number(r.minBalance));
  const deltaBalance = balance - minBalance;
  return {
    balance,
    minBalance,
    deltaBalance,
  };
};

export const fundFromWallet = async (
  reciever: string,
  amount: number,
  sender: "admin" | "operational" | "onboarding"
): Promise<string | null> => {
  const suggestedParams = await algodClient.getTransactionParams().do();
  const senderAddress =
    sender === "admin"
      ? ADMIN_WALLET
      : sender === "operational"
      ? OPERATIONAL_WALLET
      : ONBOARDING_WALLET;
  const group = [
    {
      txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: senderAddress,
        receiver: reciever,
        suggestedParams,
        amount: algosdk.algosToMicroalgos(amount),
      }),
      signerEmail: sender,
      signerAddress: senderAddress,
    },
  ];
  try {
    const { bytes, txnIds } = await signTransactions(group);
    await algodClient.sendRawTransaction(bytes).do();
    await algosdk.waitForConfirmation(algodClient, txnIds[0], 3);
    return txnIds[0];
  } catch (e: any) {
    return null;
  }
};

export const ensureOnboardingFund = async (address: string) => {
  const { balance, minBalance } = await getDetailedBalances(address);

  if (balance < minBalance && balance === 0) {
    return {
      txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: ONBOARDING_WALLET,
        receiver: address,
        amount: algosdk.algosToMicroalgos(0.1),
        suggestedParams: await algodClient.getTransactionParams().do(),
      }),
      signerEmail: "onboarding",
      signerAddress: ONBOARDING_WALLET,
    };
  }
  return null;
};
