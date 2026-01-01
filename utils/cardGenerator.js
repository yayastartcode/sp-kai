const fs = require('fs');
const path = require('path');

// Simple card generator using HTML/CSS (fallback if canvas not available)
// For production, you can enhance this with node-canvas

const generate = async (member, settings) => {
    const cardDir = path.join(__dirname, '..', 'public', 'uploads', 'cards');
    
    // Create cards directory if not exists
    if (!fs.existsSync(cardDir)) {
        fs.mkdirSync(cardDir, { recursive: true });
    }
    
    const filename = `card-${member.member_id}-${Date.now()}.html`;
    const cardPath = `/uploads/cards/${filename}`;
    const fullPath = path.join(cardDir, filename);
    
    // Generate HTML card
    const cardHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; }
        .card {
            width: 400px;
            height: 250px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 20px;
            color: white;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 100%;
            height: 100%;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .org-name {
            font-size: 24px;
            font-weight: bold;
        }
        .card-type {
            font-size: 12px;
            background: rgba(255,255,255,0.2);
            padding: 5px 10px;
            border-radius: 5px;
        }
        .content {
            display: flex;
            gap: 20px;
        }
        .photo {
            width: 80px;
            height: 100px;
            background: white;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #667eea;
            font-size: 40px;
        }
        .photo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 10px;
        }
        .info {
            flex: 1;
        }
        .name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .member-id {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 10px;
        }
        .detail {
            font-size: 12px;
            opacity: 0.8;
        }
        .footer {
            position: absolute;
            bottom: 15px;
            left: 20px;
            right: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div class="org-name">${settings.site_name || 'SERIKAT'}</div>
            <div class="card-type">KARTU ANGGOTA</div>
        </div>
        <div class="content">
            <div class="photo">
                ${member.photo ? `<img src="${member.photo}" alt="Foto">` : '👤'}
            </div>
            <div class="info">
                <div class="name">${member.name}</div>
                <div class="member-id">ID: ${member.member_id}</div>
                <div class="detail">📱 ${member.phone}</div>
                ${member.email ? `<div class="detail">✉️ ${member.email}</div>` : ''}
            </div>
        </div>
        <div class="footer">
            <span>Berlaku: ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}</span>
            <span>${settings.site_name || 'Serikat'}</span>
        </div>
    </div>
</body>
</html>`;
    
    fs.writeFileSync(fullPath, cardHTML);
    
    return cardPath;
};

module.exports = { generate };
