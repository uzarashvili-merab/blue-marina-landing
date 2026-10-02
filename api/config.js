// GET /api/config — public, non-secret settings for the page
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    pixelId: process.env.META_PIXEL_ID || '',
    whatsapp: process.env.WHATSAPP_NUMBER || '',
    rera: process.env.RERA_ORN || ''
  });
};
