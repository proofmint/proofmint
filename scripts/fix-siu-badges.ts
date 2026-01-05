import prisma from "@/lib/prisma";
import { cleanString, getHash } from "@/lib/utils";
import { getWallet } from "@/lib/vault";
import { algodClient } from "@/lib/const";
import { Indexer } from "algosdk";

const participant_badge = {
  badge: {
    name: "TEDxSIU Hyderabad S1",
    assetId: "3197424448",
    description:
      "This is issued to all the participants of TEDxSIU Hyderabad season 1",
    imageUrl: `https://ipfs.io/ipfs/Qma12PemWJnz6JQw1ATrTTiBawjcEt4jrBYfmaJKotauiD`,
    unitName: "TEDxSIUH",
    badgeType: "event",
    customProperties: [
      { key: "Date", value: "4/9/25" },
      { key: "Website", value: "https://www.ted.com/tedx/events/61543" },
      { key: "Participants", value: "285" },
    ],
  },
  issuerEmail: "rejoltedtech@gmail.com",
  issuedAt: "2025-09-04 08:58:28.367",
  receiptents: [
    "25010323167@student.slsh.edu.in",
    "25010324059@student.slsh.edu.in",
    "25010324110@student.slsh.edu.in",
    "25010324131@student.slsh.edu.in",
    "ali.nadia3047@gmail.com",
    "24010323097@student.slsh.edu.in",
    "24010323132@student.slsh.edu.in",
    "24010324103@student.slsh.edu.in",
    "bhumikabhavikatti@gmail.com",
    "janvisehgal0110@gmail.com",
    "mauryapranjal62@gmail.com",
    "soumyasa334@gmail.com",
    "srijanchatterjee958@gmail.com",
    "vikrantdhanda09@gmail.com",
    "23010323012@student.slsh.edu.in",
    "23010323032@student.slsh.edu.in",
    "23010323095@student.slsh.edu.in",
    "23010324018@student.slsh.edu.in",
    "23010324043@student.slsh.edu.in",
    "23010324063@student.slsh.edu.in",
    "23010324071@student.slsh.edu.in",
    "23010324079@student.slsh.edu.in",
    "23010324080@student.slsh.edu.in",
    "23010324081@student.slsh.edu.in",
    "23010324105@student.slsh.edu.in",
    "ashmita.c576@gmail.com",
    "chathurya.mettu9@gmail.com",
    "emytreyi@gmail.com",
    "karunyaswa@gmail.com",
    "priscillaraviprasad@gmail.com",
    "22010323114@student.slsh.edu.in",
    "22010324107@student.slsh.edu.in",
    "birrariya@gmail.com",
    "25010324072@student.slsh.edu.in",
    "25010323029@student.slsh.edu.in",
    "25010324139@student.slsh.edu.in",
    "25010323085@student.slsh.edu.in",
    "25010324182@student.slsh.edu.in",
    "25010323119@student.slsh.edu.in",
    "25010324120@student.slsh.edu.in",
    "anshyashaswi18@gmail.com",
    "25010324049@student.slsh.edu.in",
    "25010324166@student.slsh.edu.in",
    "24010323041@student.slsh.edu.in",
    "jhanvi24sep@gmail.com",
    "23010324111@student.slsh.edu.in",
    "anshikamahapatra004@gmail.com",
    "25010324075@student.slsh.edu.in",
    "rishika.yenamala0613@gmail.com",
    "25010324196@student.slsh.edu.in",
    "23010323107@student.slsh.edu.in",
    "chidrupaviviktha@gmail.com",
    "22010324057@student.slsh.edu.in",
    "monishraj0057@gmail.com",
    "25010324112@student.slsh.edu.in",
    "23010324078@student.slsh.edu.in",
    "24010323053@student.slsh.edu.in",
    "25010324081@student.slsh.edu.in",
    "22010323041@student.slsh.edu.in",
    "25010323020@student.slsh.edu.in",
    "23010324082@student.slsh.edu.in",
    "25010324041@student.slsh.edu.in",
    "24010323148@student.slsh.edu.in",
    "arpanchatterjee9791@gmail.com",
    "25010324088@student.slsh.edu.in",
    "athmikaks06@gmail.com",
    "apoorvajha2007@gmail.com",
    "divyansheedeviduttadas@gmail.com",
    "atulraj0421@gmail.com",
    "htannistha@gmail.com",
    "santhosh.manikonda@sithyd.siu.edu.in",
    "akshayagera9a@gmail.com",
    "deeurs2007@gmail.com",
    "dimpu1219@gmail.com",
    "Vardaansundriyal52@gmail.com",
    "divyanka010@gmail.com",
    "25010323164@student.slsh.edu.in",
    "roojhal2005@gmail.com",
    "25010324003@student.slsh.edu.in",
    "arkac1212@gmail.com",
    "boredomdhruv@gmail.com",
    "25010323160@student.slsh.edu.in",
    "arpithaagi2017@gmail.com",
    "devangrobin@gmail.com",
    "ww.jatins@gmail.com",
    "adityagupta882004@gmail.com",
    "23010324093@student.slsh.edu.in",
    "avichalruthsolomon@gmail.com",
    "emailid.sarmita@gmail.com",
    "Vedikavishwa22@gmail.com",
    "anubhavkumat3@gmail.com",
    "jratnam.chodagiri@gmail.com",
    "annikachinni8@gmail.com",
    "mkaruppur@gmail.com",
    "22010323070@student.slsh.edu.in",
    "akankshasingh5373@gmail.com",
    "vibhasahu902@gmail.com",
    "22010324130@student.slsh.edu.in",
    "22010324116@student.slsh.edu.in",
    "22010324122@student.slsh.edu.in",
    "yadascharan0006@gmail.com",
    "yadavtushmul@gmail.com",
    "22010323111@student.slsh.edu.in",
    "kvk994444@gmail.com",
    "architj907@gmail.com",
    "25010324092@student.slsh.edu.in",
    "tripathykhushi1627@gmail.com",
    "23010324114@student.slsh.edu.in",
    "addepalliyashasri@gmail.com",
    "22010324125@student.slsh.edu.in",
    "22010324020@student.slsh.edu.in",
    "s.m.sadiq1205@gmail.com",
    "yadvendra2208@gmail.com",
    "lokeshbobbili48@gmail.com",
    "nishanthvarma2008@gmail.com",
    "22010324141@student.slsh.edu.in",
    "23010324118@student.slsh.edu.in",
    "23010324096@student.slsh.edu.in",
    "pandeyansh1906@gmail.com",
    "anushkasingh.0720@gmail.com",
    "22010324009@student.slsh.edu.in",
    "Sriramnaidu200628@gmail.com",
    "shivamgupta20717@gmail.com",
    "25010324184@student.slsh.edu.in",
    "Prakasharnav866@gmail.com",
    "25010323033@student.slsh.edu.in",
    "25010323026@student.slsh.edu.in",
    "nehaltips@gmail.com",
    "22010323046@student.slsh.edu.in",
    "22010323039@student.slsh.edu.in",
    "diyasanjaya8@gmail.com",
    "kripaannalias@gmail.com",
    "23010323059@student.slsh.edu.in",
    "22010323101@student.slsh.edu.in",
    "parth3dlab@gmail.com",
    "mouparnadas699@gmail.com",
    "jyotishko.chatterjee@gmail.com",
    "Mukundayadavup89@gmail.com",
    "22010324099@student.slsh.edu.in",
    "tathya8055@gmail.com",
    "23010324083@student.slsh.edu.in",
    "dritheshraj@gmail.com",
    "24010324003@student.slsh.edu.in",
    "24070722017@sithyd.siu.edu.in",
    "24070721030@sithyd.siu.edu.in",
    "24070721036@sithyd.siu.edu.in",
    "abhin4946@gmail.com",
    "24070724006@sithyd.siu.edu.in",
    "24070722011@sithyd.siu.edu.in",
    "24070721043@sithyd.siu.edu.in",
    "r.anwita12@gmail.com",
    "samarthagrawal2006@gmail.com",
    "lakshman.n.hlc0596@gmail.com",
    "abhishekvadla025@gmail.com",
    "srisaikedar@gmail.com",
    "annanya.mishra17@gmail.com",
    "kondaudayram@gmail.com",
    "dayanandray143@gmail.com",
    "24070721034@sithyd.siu.edu.in",
    "sanvydeepti46@gmail.com",
    "aashritadas1@gmail.com",
    "pragyachoubey5@gmail.com",
    "adnan18443@gmail.com",
    "nikshithathota3107@gmail.com",
    "24070721038@sithyd.siu.edu.in",
    "24070721007@sithyd.siu.edu.in",
    "24070722002@sithyd.siu.edu.in",
    "deepikamishra943@gmail.com",
    "gaddamnihanthyadav@gmail.com",
    "sathyaprasadkolipaka@gmail.com",
    "sridarramprabhas.s@gmail.com",
    "parvini.1207@gmail.com",
    "palav.ojasvi@gmail.com",
    "mokshitavp@gmail.com",
    "24070721024@sithyd.siu.edu.in",
    "kollasurya5@gmail.com",
    "dharmankhambhalia132@gmail.com",
    "cherukupallypavithrayadav2019@gmail.com",
    "mokshagnareddy5@gmail.com",
    "24070721009@sithyd.siu.edu.in",
    "24070724012@sithyd.siu.edu.in",
    "24070724016@sithyd.siu.edu.in",
    "24070721023@sithyd.siu.edu.in",
    "venkateshk2346@gmail.com",
    "24070721022@sithyd.siu.edu.in",
    "24070724019@sithyd.siu.edu.in",
    "dhruva3.6sai@gmail.com",
    "pujarispoorthi519@gmail.com",
    "sohangokul20@gmail.com",
    "manvendragupta065@gmail.com",
    "madaram.akshitha@gmail.com",
    "gaurav.saraswat7607@gmail.com",
    "thatichandu26@gmail.com",
    "arnavsharma34610@gmail.com",
    "Srushith123@gmail.com",
    "naman.skh1@gmail.com",
    "24070721016@sithyd.siu.edu.in",
    "kowkuntlaabhinav2007@gmail.com",
    "peddireddytrigunesh@gmail.com",
    "venkateshguptha17@gmail.com",
    "Vadlalokesh41@gmail.com",
    "24070721002@sithyd.siu.edu.in",
    "avignyahjakku@gmail.com",
    "ykrithika1510@gmail.com",
    "chandrahaasdonthula@gmail.com",
    "srinithmanas15@gmail.com",
    "anjianna96666@gmail.com",
    "gswathireddy97@gmail.com",
    "Azizfathina@gmail.com",
    "chetanaraopasam@gmail.com",
    "mitalir77@gmail.com",
    "nitingiamalani@gmail.com",
    "rakshithareddy1918@gmail.com",
    "nandhinipasula76@gmail.com",
    "24022022017@scmshyd.siu.edu.in",
    "24022022055@scmshyd.siu.edu.in",
    "Pranav.jagilanka@gmail.com",
    "23022022034@scmshyd.siu.edu.in",
    "23022022065@scmshyd.siu.edu.in",
    "23022022075@scmshyd.siu.edu.in",
    "niharikasanapala12@gmail.com",
    "prekshakrishnan305@gmail.com",
    "prishitta.sahu15192@gmail.com",
    "25022022031@scmshyd.siu.edu.in",
    "25022022062@scmshyd.siu.edu.in",
    "25022022067@scmshyd.siu.edu.in",
    "prachyodayap25@gmail.com",
    "25022022048@scmshyd.siu.edu.in",
    "25022022026@scmshyd.siu.edu.in",
    "25022022036@scmshyd.siu.edu.in",
    "24022022024@scmshyd.siu.edu.in",
    "25022022017@scmshyd.siu.edu.in",
    "25022022010@scmshyd.siu.edu.in",
    "24022022045@scmshyd.siu.edu.in",
    "24022022019@scmshyd.siu.edu.in",
    "24022022057@scmshyd.siu.edu.in",
    "25022022006@scmshyd.siu.edu.in",
    "25022022032@scmshyd.siu.edu.in",
    "25022022038@scmshyd.siu.edu.in",
    "25022022040@scmshyd.siu.edu.in",
    "25022022042@scmshyd.siu.edu.in",
    "divvyaap@gmail.com",
    "abhiramballa46@gmail.com",
    "bandana302006@gmail.com",
    "diyathomas3355@gmail.com",
    "mathur.navya07@gmail.com",
    "24022022010@scmshyd.siu.edu.in",
    "24022022039@scmshyd.siu.edu.in",
    "vaishnavitipirneni@gmail.com",
    "23022022008@scmshyd.siu.edu.in",
    "23022022037@scmshyd.siu.edu.in",
    "23022022060@scmshyd.siu.edu.in",
    "23022022080@scmshyd.siu.edu.in",
    "nishkamula122@gmail.com",
    "24022022008@scmshyd.siu.edu.in",
    "25022022061@scmshyd.siu.edu.in",
    "25022022050@scmshyd.siu.edu.in",
    "25022022049@scmshyd.siu.edu.in",
    "25022022012@scmshyd.siu.edu.in",
    "25022022018@scmshyd.siu.edu.in",
    "25022022004@scmshyd.siu.edu.in",
    "25022022051@scmshyd.siu.edu.in",
    "gianigia9@gmail.com",
    "23022022001@scmshyd.siu.edu.in",
    "23022022056@scmshyd.siu.edu.in",
    "23022022077@scmshyd.siu.edu.in",
    "25022022005@scmshyd.siu.edu.in",
    "25021141185@sibmhyd.edu.in",
    "25022022035@scmshyd.siu.edu.in",
    "25022022009@scmshyd.siu.edu.in",
    "23022022072@scmshyd.siu.edu.in",
    "24022022050@scmshyd.siu.edu.in",
    "24022022056@scmshyd.siu.edu.in",
    "mahathialuka@icloud.com",
    "23022022016@scmshyd.siu.edu.in",
    "23022022073@scmshyd.siu.edu.in",
    "24022022037@scmshyd.siu.edu.in",
    "24022022048@scmshyd.siu.edu.in",
    "24022022003@scmchyd.siu.edu.in",
    "25022022030@scmshyd.siu.edu.in",
    "madanmohan.k@kpritech.ac.in",
    "bhuvaneshwaripothuraju2005@gmail.com",
    "ramcharancholleti@gmail.com",
    "drpbinduswetha@gmail.com",
    "greeshmahvs370@gmail.com",
  ],
};

const volunteer_badge = {
  badge: {
    name: "TEDxSIU Hyderabad",
    assetId: "3200851325",
    description:
      "This is issued to all the volunteers of TEDxSIU Hyderabad season 1",
    imageUrl: `https://ipfs.io/ipfs/Qmazvk2Je6YvZLkJWGoaJ47oWv4f6ZUVMRGKxw6cvCySGJ`,
    unitName: "TEDxSIUH",
    badgeType: "achievement",
    customProperties: [
      { key: "Date", value: "4/9/25" },
      { key: "Website", value: "https://www.ted.com/tedx/events/61543" },
    ],
  },
  issuerEmail: "rejoltedtech@gmail.com",
  issuedAt: "2025-09-06 07:03:34.367",
  receiptents: [
    "ritambaripanda@gmail.com",
    "24070721034@sithyd.siu.edu.in",
    "24070721038@sithyd.siu.edu.in",
    "24070721007@sithyd.siu.edu.in",
    "23010323020@student.slsh.edu.in",
    "23010323107@student.slsh.edu.in",
    "24010323041@student.slsh.edu.in",
    "23010324024@student.slsh.edu.in",
    "22010323073@student.slsh.edu.in",
    "23010324037@student.slsh.edu.in",
  ],
};

const core_team_badge = {
  badge: {
    name: "TEDxSIU Hyderabad",
    assetId: "3196189474",
    description:
      "This is issued to all the core team of TEDxSIU Hyderabad season 1",
    imageUrl: `https://ipfs.io/ipfs/QmUE4UvCBkh9uvrLFeCK4hEMgYewsyWEAwyjJPmGuBLoEC`,
    unitName: "TEDxSIUH",
    badgeType: "achievement",
    customProperties: [
      { key: "Date", value: "4/9/25" },
      { key: "Website", value: "https://www.ted.com/tedx/events/61543" },
      { key: "Team Size", value: "40" },
    ],
  },
  issuerEmail: "rejoltedtech@gmail.com",
  issuedAt: "2025-09-03 12:42:43.367",
  receiptents: [
    "bhalsingaditi@gmail.com",
    "advika280805@gmail.com",
    "adwitapravish@gmail.com",
    "ananyaaa3080@gmail.com",
    "ananyasinha21march@gmail.com",
    "anirudhpsyadav@gmail.com",
    "anshupriyaparchuri@gmail.com",
    "choudhuryanuja64@gmail.com",
    "Spectrumat246@gmail.com",
    "Asmi.agarwal2006@gmail.com",
    "23022022017@scmshyd.siu.edu.in",
    "21010324042@student.slsh.edu.in",
    "ravistudy128@gmail.com",
    "24010324041@student.slsh.edu.in",
    "dimplemd1625@gmail.com",
    "parthivkeyatoor@gmail.com",
    "vainavikotagiri06@gmail.com",
    "K.sricharanrao@gmail.com",
    "hkurikala@gmail.com",
    "pvlsrujana@gmail.com",
    "zakiurrahman540@gmail.com",
    "meenakshivedala@gmail.com",
    "morri.sushama@gmail.com",
    "pramitpanigrahi0@gmail.com",
    "riyashastri2005@gmail.com",
    "23010323067@student.slsh.edu",
    "saanvidande@gmail.com",
    "sengarshreyashka@gmail.com",
    "smaran.anand@gmail.com",
    "24070721004@sithyd.siu.edu.in",
    "24070721040@sithyd.siu.edu.in",
    "vidiyalavaishnavi@gmail.com",
    "24010323129@student.slsh.edu.in",
    "akash.mallareddy@gmail.com",
    "saiprashanth@sithyd.siu.edu.in",
    "director@sithyd.siu.edu.in",
    "director@slsh.edu.in",
    "director@sibm.edu.in",
    "pallatinarsimhulu@sithyd.siu.edu.in",
    "Shrivastavparth4@gmail.com",
  ],
};

const getIssuerId = async (email: string) => {
  const issuer = await prisma.issuer.findFirst({
    where: {
      user: {
        email: email,
      },
    },
    include: {
      user: true,
    },
  });
  if (!issuer) {
    throw new Error(`Issuer not found for email: ${email}`);
  }
  return { id: issuer.id, walletAddress: issuer.user.walletAddress };
};

const indexer = new Indexer(
  "a".repeat(64),
  "https://mainnet-idx.4160.nodely.dev",
  443
);

const getAssetClaimedDetails = async (
  assetId: string,
  senderAddress: string
) => {
  try {
    const transactionDetails: {
      receiverAddress: string;
      txnId: string;
      claimedAt: Date;
    }[] = [];
    let nextToken = null;
    while (true) {
      let txns;
      if (nextToken) {
        txns = await indexer
          .lookupAssetTransactions(Number(assetId))
          .address(senderAddress)
          .addressRole("sender")
          .currencyLessThan(2)
          .currencyGreaterThan(0)
          .txType("axfer")
          .excludeCloseTo(true)
          .nextToken(nextToken)
          .do();
      } else {
        txns = await indexer
          .lookupAssetTransactions(Number(assetId))
          .address(senderAddress)
          .addressRole("sender")
          .currencyLessThan(2)
          .currencyGreaterThan(0)
          .txType("axfer")
          .excludeCloseTo(true)
          .do();
      }
      if (txns.transactions.length > 0) {
        for (const txn of txns.transactions) {
          if (
            txn.assetTransferTransaction &&
            txn.id &&
            txn.roundTime &&
            txn.assetTransferTransaction.receiver
          ) {
            transactionDetails.push({
              receiverAddress: txn.assetTransferTransaction.receiver,
              txnId: txn.id,
              claimedAt: new Date(txn.roundTime),
            });
          }
        }
      }

      console.log(
        `   📊 Found ${txns.transactions.length} transactions on blockchain`
      );

      if (txns.nextToken) {
        nextToken = txns.nextToken;
      } else {
        break;
      }
    }
    return transactionDetails;
  } catch (error) {
    return [];
  }
};

async function main() {
  console.log("🚀 Starting badge import process...");
  console.log("=".repeat(60));

  const startTime = Date.now();

  try {
    console.log("🚀 Starting badge import process...");
    console.log("=".repeat(60));

    const startTime = Date.now();

    // Store all records to be created/updated
    const badgesToCreate: Array<{
      badge: typeof participant_badge.badge;
      issuerEmail: string;
      issuedAt: string;
      receiptents: string[];
      blockchainClaimsToUpdate: Array<{
        badgeId: string;
        issuerId: string;
        email: string;
        claimedAt: Date;
        txnId: string;
      }>;
    }> = [];

    // Process all badges and collect blockchain data (outside transaction)
    const badges = [participant_badge, volunteer_badge, core_team_badge];
    for (const badge of badges) {
      console.log(`\n📋 Processing badge: ${badge.badge.name}`);
      console.log(`   - Asset ID: ${badge.badge.assetId}`);
      console.log(`   - Recipients count: ${badge.receiptents.length}`);

      const issuer = await getIssuerId(badge.issuerEmail);
      console.log(`   - Issuer ID: ${issuer.id}`);

      // Build wallet to email map
      const walletEmailMap = new Map<string, string>();
      console.log("   🔗 Building wallet-to-email map...");
      for (const email of badge.receiptents) {
        const wallet = await getWallet(getHash(cleanString(email)));
        if (wallet) {
          walletEmailMap.set(wallet, cleanString(email));
        }
      }
      console.log(`   ✅ Mapped ${walletEmailMap.size} wallets to emails`);

      // Fetch blockchain claims (outside transaction)
      console.log("   🔍 Fetching blockchain transactions...");
      const transactionDetails = await getAssetClaimedDetails(
        badge.badge.assetId,
        issuer.walletAddress
      );
      console.log(
        `   📊 Found ${transactionDetails.length} transactions on blockchain`
      );

      const blockchainClaimsToUpdate: Array<{
        badgeId: string;
        issuerId: string;
        email: string;
        claimedAt: Date;
        txnId: string;
      }> = [];

      // Store claimed badges for later update
      for (const txnDetail of transactionDetails) {
        const email = walletEmailMap.get(txnDetail.receiverAddress);
        if (!email) {
          console.warn(
            `   ⚠️  No email found for wallet: ${txnDetail.receiverAddress}`
          );
          continue;
        }

        blockchainClaimsToUpdate.push({
          badgeId: "", // Will be set after badge creation
          issuerId: issuer.id,
          email: email,
          claimedAt: txnDetail.claimedAt,
          txnId: txnDetail.txnId,
        });
      }

      // Store badge data for later insertion
      badgesToCreate.push({
        badge: badge.badge,
        issuerEmail: badge.issuerEmail,
        issuedAt: badge.issuedAt,
        receiptents: badge.receiptents,
        blockchainClaimsToUpdate: blockchainClaimsToUpdate,
      });
    }

    // Now perform all database operations in a single transaction
    console.log("\n💾 Performing database operations...");
    await prisma.$transaction(
      async (tx) => {
        let totalBadgesCreated = 0;
        let totalIssuedBadgesCreated = 0;
        let totalBadgesClaimed = 0;

        for (const badgeData of badgesToCreate) {
          const issuer = await getIssuerId(badgeData.issuerEmail);

          // Create badge record
          console.log("   📝 Creating badge record...");
          const createdBadge = await tx.badge.create({
            data: {
              ...badgeData.badge,
              issuerId: issuer.id,
              createdAt: new Date(badgeData.issuedAt),
              updatedAt: new Date(badgeData.issuedAt),
            },
          });
          console.log(`   ✅ Badge created with ID: ${createdBadge.id}`);
          totalBadgesCreated++;

          // Create issued badge records
          console.log("   📧 Creating issued badge records...");
          const issuedBadges = await tx.issuedBadge.createMany({
            data: badgeData.receiptents.map((email) => ({
              badgeId: createdBadge.id,
              receiverEmail: cleanString(email),
              issuerId: issuer.id,
              status: "PENDING",
              issuedAt: new Date(badgeData.issuedAt),
              claimedAt: null,
              transactionHash: null,
            })),
          });
          console.log(
            `   ✅ Created ${issuedBadges.count} issued badge records`
          );
          totalIssuedBadgesCreated += issuedBadges.count;

          // Update claimed badges
          for (const claim of badgeData.blockchainClaimsToUpdate) {
            if (claim.email) {
              const updated = await tx.issuedBadge.updateMany({
                where: {
                  AND: {
                    receiverEmail: cleanString(claim.email),
                    issuerId: issuer.id,
                    badgeId: createdBadge.id,
                  },
                },
                data: {
                  status: "CLAIMED",
                  claimedAt: claim.claimedAt,
                  transactionHash: claim.txnId,
                },
              });

              if (updated.count > 0) {
                totalBadgesClaimed++;
              }
            }
          }
        }

        console.log("\n" + "=".repeat(60));
        console.log("📊 Import Summary:");
        console.log(`   - Total badges created: ${totalBadgesCreated}`);
        console.log(
          `   - Total issued badges created: ${totalIssuedBadgesCreated}`
        );
        console.log(
          `   - Total badges marked as claimed: ${totalBadgesClaimed}`
        );
      },
      {
        timeout: 30000, // Increase timeout to 30 seconds for the batch write
      }
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log("\n✅ Badge import process completed successfully!");
    console.log(`⏱️  Total execution time: ${duration} seconds`);
  } catch (error) {
    console.error("\n❌ Error during badge import process:");
    console.error("   All changes have been rolled back.");
    console.error("   Error details:", error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("🎉 Script execution finished.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });
