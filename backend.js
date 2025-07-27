import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config'
// In-memory conversation history
const History = [];
const ai = new GoogleGenAI({ apiKey: process.env.GENIAPI });

// Tool functions
function sum({ num1, num2 }) {
  return num1 + num2;
}

function prime({ num }) {
  if (num < 2) return false;
  for (let i = 2; i <= Math.sqrt(num); i++)
    if (num % i === 0) return false;
  return true;
}

async function getCryptoPrice({ coin }) {
  const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin}`);
  const data = await response.json();
  if (data && data[0] && data[0].current_price) {
    return `${coin} ka current price: $${data[0].current_price}`;
  }
  return `Sorry, ${coin} ka price nahi mil paaya.`;
}

// Tool Declarations
const sumDeclaration = {
  name: 'sum',
  description: "Get the sum of 2 number",
  parameters: {
    type: 'OBJECT',
    properties: {
      num1: {
        type: 'NUMBER',
        description: 'It will be first number for addition ex: 10'
      },
      num2: {
        type: 'NUMBER',
        description: 'It will be Second number for addition ex: 10'
      }
    },
    required: ['num1', 'num2']
  }
};

const primeDeclaration = {
  name: 'prime',
  description: "Get if number is prime or not",
  parameters: {
    type: 'OBJECT',
    properties: {
      num: {
        type: 'NUMBER',
        description: 'It will be the number to find if it is prime or not ex: 13'
      },
    },
    required: ['num']
  }
};

const cryptoDeclaration = {
  name: 'getCryptoPrice',
  description: "Get the current price of any crypto currency like bitcoin",
  parameters: {
    type: 'OBJECT',
    properties: {
      coin: {
        type: 'STRING',
        description: 'It will be the crypto currency name, like bitcoin'
      },
    },
    required: ['coin']
  }
};

const availableTools = {
  sum: sum,
  prime: prime,
  getCryptoPrice: getCryptoPrice,
};

// AI Agent logic as API
async function runAgent(userProblem) {
  History.push({
    role: 'user',
    parts: [{ text: userProblem }]
  });

  while (true) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,
      config: {
        systemInstruction: `You are an AI Agent, You have access of 3 available tools: sum of 2 number, get crypto price of any currency, and check if a number is prime.
        Use these tools whenever required to confirm user query.
        If user asks a general question you can answer it directly if you don't need help of these three tools`,
        tools: [{
          functionDeclarations: [sumDeclaration, primeDeclaration, cryptoDeclaration]
        }],
      },
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      const { name, args } = response.functionCalls[0];
      const funCall = availableTools[name];
      const result = await funCall(args);

      // Add model and function response to history
      History.push({
        role: "model",
        parts: [
          { functionCall: response.functionCalls[0] }
        ],
      });

      History.push({
        role: "user",
        parts: [
          { functionResponse: { name, response: { result } } }
        ],
      });
    } else {
      History.push({
        role: 'model',
        parts: [{ text: response.text }]
      });
      return response.text;
    }
  }
}

// Express server
const app = express();
app.use(cors());
app.use(express.json());

app.post('/ask', async (req, res) => {
  try {
    const userProblem = req.body.question;
    const answer = await runAgent(userProblem);
    res.json({ response: answer });
  } catch (e) {
    res.json({ response: "AI agent error: " + e.message });
  }
});

app.listen(5000, () => {
  console.log("AI backend running on port 5000");
});
