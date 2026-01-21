import { NextRequest, NextResponse } from 'next/server';
import { PinataSDK } from 'pinata';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jsonData, imageCid } = body;

    // 1. STANDARD JSON UPLOAD
    if (action === 'uploadJson') {
      const upload = await pinata.upload.public.json(jsonData);
      const url = await pinata.gateways.public.convert(upload.cid);
      return NextResponse.json({ success: true, cid: upload.cid, metadataUrl: url });
    }

    // 2. BUNDLE METADATA LOGIC (Refactored)
    if (action === 'createBundleMetadata') {
      // Logic: Use environment variable 'ALBUNDY' (DEFAULTIMG) or the provided imageCid
      const gatewayUrl = process.env.PINATA_GATEWAY;
      const nftImage = process.env.ALBUNDY || (imageCid ? `https://${gatewayUrl}/ipfs/${imageCid}` : "");

      const metaplexMetadata = {
        ...jsonData,
        image: nftImage || jsonData.image,
        properties: {
          files: nftImage ? [{ uri: nftImage, type: "image/png" }] : [],
          category: "image"
        }
      };

      const finalUpload = await pinata.upload.public.json(metaplexMetadata);
      const metadataUrl = await pinata.gateways.public.convert(finalUpload.cid);

      return NextResponse.json({
        success: true,
        cid: finalUpload.cid,
        metadataUrl
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Pinata API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}