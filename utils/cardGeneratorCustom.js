const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const templateDir = path.join(
  __dirname,
  "..",
  "public",
  "uploads",
  "card-templates",
  "default"
);
const cardsDir = path.join(__dirname, "..", "public", "uploads", "cards");

// Ensure cards directory exists
if (!fs.existsSync(cardsDir)) {
  fs.mkdirSync(cardsDir, { recursive: true });
}

const generate = async (member, settings) => {
  try {
    const backgroundPath = path.join(templateDir, "background.png");
    const overlayPath = path.join(templateDir, "overlay.png");

    // Member photo path - handle both with and without leading slash
    let memberPhotoPath = null;
    if (member.photo) {
      const photoPath = member.photo.startsWith("/")
        ? member.photo.substring(1)
        : member.photo;
      memberPhotoPath = path.join(__dirname, "..", "public", photoPath);
    }

    // Check if background exists
    if (!fs.existsSync(backgroundPath)) {
      throw new Error("Background template not found");
    }

    // Get background dimensions
    const backgroundMeta = await sharp(backgroundPath).metadata();
    const cardWidth = backgroundMeta.width;
    const cardHeight = backgroundMeta.height;

    // Determine positions based on card size (assuming 1200x800 or similar landscape)
    // Profile picture on LEFT side - SQUARE (1:1 ratio)
    const profileWidth = Math.round(cardWidth * 0.30); // 30% of card width (1.2x larger)
    const profileHeight = profileWidth; // Same as width for 1:1 ratio (SQUARE)
    const profileX = Math.round(cardWidth * 0.04); // 4% from left (moved left, align with logo)
    const profileY = Math.round(cardHeight * 0.25 + 15); // 25% from top + 15px margin down
    const borderRadius = Math.round(profileWidth * 0.15); // 15% border radius for rounded corners

    // Text area in MIDDLE/CENTER - shifted right & up
    const textX = Math.round(cardWidth / 2 + cardWidth * 0.15); // Center + 15% shift right
    const nameY = Math.round(cardHeight * 0.48); // 48% down - name
    const niasY = Math.round(cardHeight * 0.56); // 56% down - NIAS (closer to name, ~10px margin)

    let compositeArray = [{ input: backgroundPath, top: 0, left: 0 }];

    // Add member photo if exists
    if (memberPhotoPath && fs.existsSync(memberPhotoPath)) {
      try {
        // Resize and crop member photo to fit profile area with rounded corners
        let memberPhotoResized = await sharp(memberPhotoPath)
          .resize(profileWidth, profileHeight, {
            fit: "cover",
            position: "center",
          })
          .toBuffer();

        // Create yellow background with rounded corners
        const yellowBg = Buffer.from(
          `<svg width="${profileWidth}" height="${profileHeight}">
            <rect width="${profileWidth}" height="${profileHeight}" rx="${borderRadius}" ry="${borderRadius}" fill="#FCE330"/>
          </svg>`
        );

        // Composite yellow background first
        let photoWithYellowBg = await sharp(yellowBg)
          .composite([{ input: memberPhotoResized }])
          .toBuffer();

        // Create mask for rounded corners
        const maskSvg = Buffer.from(
          `<svg width="${profileWidth}" height="${profileHeight}">
            <rect width="${profileWidth}" height="${profileHeight}" rx="${borderRadius}" ry="${borderRadius}" fill="white"/>
          </svg>`
        );

        // Apply mask to get rounded corners
        memberPhotoResized = await sharp(photoWithYellowBg)
          .composite([{ input: maskSvg, blend: "dest-in" }])
          .toBuffer();

        compositeArray.push({
          input: memberPhotoResized,
          top: profileY,
          left: profileX,
        });

        // Add overlay frame on bottom corner of profile picture if exists
        if (fs.existsSync(overlayPath)) {
          try {
            const overlayMeta = await sharp(overlayPath).metadata();
            // Resize overlay to 82.5% of original size (1.5x larger than before)
            const overlayScale = 0.825;
            const overlayWidth = Math.round(overlayMeta.width * overlayScale);
            const overlayHeight = Math.round(overlayMeta.height * overlayScale);

            // Resize overlay
            const overlayResized = await sharp(overlayPath)
              .resize(overlayWidth, overlayHeight, { fit: 'inside' })
              .toBuffer();

            // Position overlay to bottom-right, shifted left 55px and down 60px
            const overlayX = profileX + profileWidth - Math.round(overlayWidth * 0.15) - 55;
            const overlayY = profileY + profileHeight - overlayHeight + 60;

            compositeArray.push({
              input: overlayResized,
              top: overlayY,
              left: overlayX,
            });
          } catch (overlayErr) {
            console.warn(
              "Overlay image error (continuing without overlay):",
              overlayErr.message
            );
          }
        }
      } catch (photoErr) {
        console.warn(
          "Member photo error (continuing without photo):",
          photoErr.message
        );
      }
    }

    // Create SVG text overlays - CENTERED with new styling
    const nameText = (member.name || "Nama Member").toUpperCase();
    const niasText = `NIAS: ${member.nias || "Belum ada"}`;

    // Name text - WHITE, 55px BOLD, Arial, centered
    const nameSvg = Buffer.from(`
            <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
                <text x="${textX}" y="${nameY}" font-family="Arial, sans-serif" font-size="55" font-weight="bold" fill="#7A7A7A" text-anchor="middle" dominant-baseline="middle">${escapeXml(
      nameText
    )}</text>
            </svg>
        `);

    compositeArray.push({
      input: nameSvg,
      top: 0,
      left: 0,
    });

    // NIAS text - DARK ORANGE, 34px BOLD, Arial, centered
    const niasSvg = Buffer.from(`
            <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
                <text x="${textX}" y="${niasY}" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#cc5500" text-anchor="middle" dominant-baseline="middle">${escapeXml(
      niasText
    )}</text>
            </svg>
        `);

    compositeArray.push({
      input: niasSvg,
      top: 0,
      left: 0,
    });

    // Generate final front card
    const timestamp = Date.now();
    const frontFilename = `card-${member.member_id}-front-${timestamp}.png`;
    const frontCardPath = path.join(cardsDir, frontFilename);

    await sharp(backgroundPath)
      .composite(compositeArray)
      .png()
      .toFile(frontCardPath);

    console.log(`Front card generated: ${frontFilename}`);

    // Generate back card if back.png exists
    const backPath = path.join(templateDir, "back.png");
    let backFilename = null;
    let backCardPath = null;
    let backImagePath = null;

    if (fs.existsSync(backPath)) {
      backFilename = `card-${member.member_id}-back-${timestamp}.png`;
      backCardPath = path.join(cardsDir, backFilename);

      // Simply copy the back template (no dynamic content)
      await sharp(backPath)
        .png()
        .toFile(backCardPath);

      backImagePath = `/uploads/cards/${backFilename}`;
      console.log(`Back card generated: ${backFilename}`);
    }

    return {
      imagePath: `/uploads/cards/${frontFilename}`,
      frontImagePath: `/uploads/cards/${frontFilename}`,
      backImagePath: backImagePath,
      filePath: frontCardPath,
      frontFilePath: frontCardPath,
      backFilePath: backCardPath,
      filename: frontFilename,
      frontFilename: frontFilename,
      backFilename: backFilename,
      memberId: member.member_id
    };
  } catch (error) {
    console.error("Card generation error:", error);
    throw error;
  }
};

// Helper function to escape XML special characters
function escapeXml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = { generate };
