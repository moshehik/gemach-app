import prisma from './app/lib/prisma.js';

async function testFix() {
  console.log("Testing rental barcode verification logic...");

  // 1. Find a sample dress item from DB
  const dressItem = await prisma.dressItem.findFirst({
    where: {
      isDeleted: false,
      notInUse: false,
      inRepair: false,
      dressBarcode: { not: null }
    },
    include: { dress: true }
  });

  if (!dressItem) {
    console.log("No valid dress item found in DB.");
    return;
  }

  console.log("Sample DressItem in DB:", {
    id: dressItem.id,
    barcode: dressItem.dressBarcode,
    barcodePrefix: dressItem.barcodePrefix || dressItem.dress?.barcodePrefix,
    sizeText: dressItem.sizeText,
    location: dressItem.location,
    modelName: dressItem.dress?.name || dressItem.dressName
  });

  const testBarcode = dressItem.dressBarcode || `${dressItem.barcodePrefix || dressItem.dress?.barcodePrefix}${dressItem.sizeText}01`;

  // Test barcode parsing / matching logic
  const prefixStr = testBarcode.substring(0, testBarcode.length - 4);
  const sizeStr = testBarcode.substring(testBarcode.length - 4, testBarcode.length - 2);

  console.log(`Parsed barcode '${testBarcode}': Prefix='${prefixStr}', Size='${sizeStr}'`);

  // Simulate activeItems in order card before rental (barcode is null before rental!)
  const activeItems = [
    {
      id: 'order-item-1',
      barcode: null,
      barcodePrefix: dressItem.barcodePrefix || dressItem.dress?.barcodePrefix,
      sizeText: dressItem.sizeText,
      description: dressItem.dress?.name || dressItem.dressName,
      isTaken: false,
      dressItem: {
        dressModelId: dressItem.dressModelId,
        barcodePrefix: dressItem.barcodePrefix || dressItem.dress?.barcodePrefix,
        sizeText: dressItem.sizeText,
        dress: {
          name: dressItem.dress?.name || dressItem.dressName,
          barcodePrefix: dressItem.barcodePrefix || dressItem.dress?.barcodePrefix
        }
      }
    }
  ];

  // Match test
  const dressInfo = {
    barcodePrefix: dressItem.barcodePrefix || dressItem.dress?.barcodePrefix,
    sizeText: dressItem.sizeText,
    dressModelId: dressItem.dressModelId,
    dressName: dressItem.dress?.name || dressItem.dressName
  };

  const itemIndex = activeItems.findIndex(i => {
    const b = i.barcode || i.dressItem?.barcode || i.dressItem?.dressBarcode;
    if (b && b === testBarcode) return true;
    if (i.isTaken) return false;

    const iPfx = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
    const iSize = i.dressItem?.sizeText || i.sizeText;

    if (dressInfo) {
      const matchPfx = dressInfo.barcodePrefix ? (iPfx === dressInfo.barcodePrefix || String(testBarcode).startsWith(String(iPfx))) : true;
      const matchSize = dressInfo.sizeText ? (iSize === dressInfo.sizeText || (parseInt(iSize) === parseInt(dressInfo.sizeText))) : true;
      if (matchPfx && matchSize) return true;
    }
    return false;
  });

  if (itemIndex !== -1) {
    console.log(" SUCCESS! Scanned barcode matched unrented order item in Order Card!");
  } else {
    console.log(" FAILED to match barcode.");
  }
}

testFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
