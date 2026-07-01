const dotenv = require('dotenv');
dotenv.config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('GEMINI_API_KEY not set');
  process.exit(1);
}

const gen = new GoogleGenerativeAI(key);

(async () => {
  try {
    const model = gen.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const res = await model.generateContent('Say hello briefly.');
    console.log('Response text:', res.text ? res.text() : '(no text())');
  } catch (err) {
    console.error('Gemini test error:', err);
    process.exit(1);
  }
})();
