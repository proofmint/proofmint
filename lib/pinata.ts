import { PINATA_JWT } from "./const";

const uploadToPinata = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const pinataOptions = JSON.stringify({
    cidVersion: 0,
  });
  formData.append("pinataOptions", pinataOptions);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  return res.json();
};

const uploadJsonToPinata = async (json: any) => {
  try {
    const data = JSON.stringify({
      pinataContent: json,
      pinataMetadata: { name: "metadata.json" },
    });

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      body: data,
      headers: {
        "Content-Type": `application/json`,
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    });
    return res.json();
  } catch (error) {
    console.error(`Error uploading JSON to Pinata: ${error}`);
    throw error;
  }
};

export { uploadToPinata, uploadJsonToPinata };