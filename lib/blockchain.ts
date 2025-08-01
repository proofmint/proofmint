import algosdk from "algosdk";
import { algodClient, adminWallet } from "./const";

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

export const fundFromMasterWallet = async (
  reciever: string,
  amount: number
): Promise<string | null> => {
  const suggestedParams = await algodClient.getTransactionParams().do();
  const xferTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: adminWallet.addr,
    receiver: reciever,
    suggestedParams,
    amount: algosdk.algosToMicroalgos(amount),
  });
  const signedXferTxn = xferTxn.signTxn(adminWallet.sk);
  try {
    await algodClient.sendRawTransaction(signedXferTxn).do();
    const result = await algosdk.waitForConfirmation(
      algodClient,
      xferTxn.txID().toString(),
      3
    );
    var confirmedRound = result.confirmedRound;
    return xferTxn.txID();
  } catch (e: any) {
    return null;
  }
};

export const ensureFund = async (address: string, minDeltaAmount: number) => {
  const { deltaBalance } = await getDetailedBalances(address);
  if (deltaBalance < minDeltaAmount) {
    if (!(await fundFromMasterWallet(address, minDeltaAmount - deltaBalance))) {
      throw new Error("Failed to Fund To Cover Delta Amount");
    }
  }
};
