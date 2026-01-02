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
    const profileWidth = Math.round(cardWidth * 0.225); // 22.5% of card width (increased 5%)
    const profileHeight = profileWidth; // Same as width for 1:1 ratio (SQUARE)
    const profileX = Math.round(cardWidth * 0.06); // 6% from left (moved left 3%)
    const profileY = Math.round(cardHeight * 0.32 + 15); // 32% from top (moved up 3%)
    const borderRadius = Math.round(profileWidth * 0.15); // 15% border radius for rounded corners
    const borderWidth = 5; // White border width in pixels

    // Text area in MIDDLE/CENTER - shifted right & up
    const textX = Math.round(cardWidth / 2 + cardWidth * 0.15); // Center + 15% shift right
    const nameY = Math.round(cardHeight * 0.43); // 43% down - name
    const niasY = Math.round(cardHeight * 0.51); // 51% down - NIAS

    let compositeArray = [{ input: backgroundPath, top: 0, left: 0 }];

    // Add member photo - use default avatar if no photo exists
    const defaultAvatarPath = path.join(templateDir, "avatar.png");
    let photoToUse = null;

    if (memberPhotoPath && fs.existsSync(memberPhotoPath)) {
      photoToUse = memberPhotoPath;
    } else if (fs.existsSync(defaultAvatarPath)) {
      photoToUse = defaultAvatarPath;
    }

    if (photoToUse) {
      try {
        // Calculate inner photo size (smaller to accommodate border)
        const innerWidth = profileWidth - (borderWidth * 2);
        const innerHeight = profileHeight - (borderWidth * 2);
        const innerRadius = Math.round(innerWidth * 0.15);

        // Resize and crop member photo to fit inner area
        const memberPhotoResized = await sharp(photoToUse)
          .resize(innerWidth, innerHeight, {
            fit: "cover",
            position: "center",
          })
          .png()
          .toBuffer();

        // Create inner photo with rounded corners mask
        const innerMaskSvg = Buffer.from(
          `<svg width="${innerWidth}" height="${innerHeight}">
            <rect width="${innerWidth}" height="${innerHeight}" rx="${innerRadius}" ry="${innerRadius}" fill="white"/>
          </svg>`
        );

        // Apply rounded corners to inner photo
        const photoRounded = await sharp(memberPhotoResized)
          .ensureAlpha()
          .composite([{ input: innerMaskSvg, blend: "dest-in" }])
          .png()
          .toBuffer();

        // Create white border frame (larger container with rounded corners)
        const borderFrameSvg = Buffer.from(
          `<svg width="${profileWidth}" height="${profileHeight}">
            <rect width="${profileWidth}" height="${profileHeight}" rx="${borderRadius}" ry="${borderRadius}" fill="white"/>
          </svg>`
        );

        // Place rounded photo on top of white border frame
        const photoWithBorder = await sharp(borderFrameSvg)
          .composite([{
            input: photoRounded,
            top: borderWidth,
            left: borderWidth
          }])
          .png()
          .toBuffer();

        compositeArray.push({
          input: photoWithBorder,
          top: profileY,
          left: profileX,
        });

        // Add overlay frame on bottom corner of profile picture if exists
        if (fs.existsSync(overlayPath)) {
          try {
            const overlayMeta = await sharp(overlayPath).metadata();
            // Resize overlay to 66% of original size (20% smaller than before)
            const overlayScale = 0.66;
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

    // Font sizes
    const nameFontSize = 45;
    const niasFontSize = 34;

    // Estimate text widths (approx 0.6 of font size per character for bold Arial)
    const nameTextWidth = nameText.length * (nameFontSize * 0.65);
    const niasTextWidth = niasText.length * (niasFontSize * 0.65);

    // Use the wider text to determine box width
    const maxTextWidth = Math.max(nameTextWidth, niasTextWidth);

    // Border settings with dynamic width
    const textPadding = 25; // Padding around text (left + right = 50px total)
    const textBoxWidth = Math.round(maxTextWidth + (textPadding * 2));
    const textBoxHeight = Math.round(nameFontSize + niasFontSize + 70); // Height for both texts + spacing
    const textBoxX = textX - (textBoxWidth / 2); // Center horizontally at textX
    const textBoxY = nameY - nameFontSize; // Start above name position
    const textBoxRadius = 12; // Border radius
    const textBoxBorderWidth = 3; // Border stroke width

    // White border container for Name and NIAS
    const textBorderSvg = Buffer.from(`
            <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
                <rect x="${textBoxX}" y="${textBoxY}" width="${textBoxWidth}" height="${textBoxHeight}" 
                      rx="${textBoxRadius}" ry="${textBoxRadius}" 
                      fill="none" stroke="white" stroke-width="${textBoxBorderWidth}"/>
            </svg>
        `);

    compositeArray.push({
      input: textBorderSvg,
      top: 0,
      left: 0,
    });

    // Name text - inside the border box
    const nameSvg = Buffer.from(`
            <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
                <text x="${textX}" y="${nameY}" font-family="Arial, sans-serif" font-size="${nameFontSize}" font-weight="bold" fill="#7A7A7A" text-anchor="middle" dominant-baseline="middle">${escapeXml(
      nameText
    )}</text>
            </svg>
        `);

    compositeArray.push({
      input: nameSvg,
      top: 0,
      left: 0,
    });

    // NIAS text - DARK ORANGE
    const niasSvg = Buffer.from(`
            <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
                <text x="${textX}" y="${niasY}" font-family="Arial, sans-serif" font-size="${niasFontSize}" font-weight="bold" fill="#cc5500" text-anchor="middle" dominant-baseline="middle">${escapeXml(
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
