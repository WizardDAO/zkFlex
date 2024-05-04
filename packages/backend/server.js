// server.js

import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { gql, GraphQLClient } from 'graphql-request'
import { generateProof } from "./zk-snarks.js";
import { Web3Storage, getFilesFromPath, File } from 'web3.storage'
import { ethers } from "ethers";
import { connectDB } from "./config/db.js";
import ProofModel from "./models/Proof.model.js";
import crypto from 'crypto'
// Load environment variables from .env file
dotenv.config();

const app = express();
const WEB3STORAGE_TOKEN = process.env.WEB3STORAGE_TOKEN;

function makeStorageClient () {
  return new Web3Storage({ token: WEB3STORAGE_TOKEN })
}
function makeFileObjects (obj, name) {
  const buffer = Buffer.from(JSON.stringify(obj))

  const files = new File([buffer], `${name}.json`)
  return files
}

function makeStringFile (txt, name) {
  const files = [
    new File([txt], `${name}.txt`),
  ]
  return files
}

async function storeFiles (files, name) {
  const data = new URLSearchParams();
  data.append('collectionID', name)
  data.append('file', files)
  
  const res = await fetch('https://preserve.nft.storage/api/v1/collection/add_tokens', {
      method: 'post',
      headers: {
          'Authorization': 'Bearer ' + WEB3STORAGE_TOKEN,
      },
      body: data,
  })
  const json = await res.json()
  return json
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // replace * with your app's URL if possible
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.post("/generate", async (req, res) => {
  try {
    const message = req.body.message;
    const address = req.body.address;
    const tokenAddress = req.body.tokenAddress
    const symbol = req.body.symbol;
    const price = 3000;
    let value = 0;
    const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
    const abi = [
      {
          "constant": true,
          "inputs": [],
          "name": "name",
          "outputs": [
              {
                  "name": "",
                  "type": "string"
              }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
      },
      {
          "constant": false,
          "inputs": [
              {
                  "name": "_spender",
                  "type": "address"
              },
              {
                  "name": "_value",
                  "type": "uint256"
              }
          ],
          "name": "approve",
          "outputs": [
              {
                  "name": "",
                  "type": "bool"
              }
          ],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "function"
      },
      {
          "constant": true,
          "inputs": [],
          "name": "totalSupply",
          "outputs": [
              {
                  "name": "",
                  "type": "uint256"
              }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
      },
      {
          "constant": false,
          "inputs": [
              {
                  "name": "_from",
                  "type": "address"
              },
              {
                  "name": "_to",
                  "type": "address"
              },
              {
                  "name": "_value",
                  "type": "uint256"
              }
          ],
          "name": "transferFrom",
          "outputs": [
              {
                  "name": "",
                  "type": "bool"
              }
          ],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "function"
      },
      {
          "constant": true,
          "inputs": [],
          "name": "decimals",
          "outputs": [
              {
                  "name": "",
                  "type": "uint8"
              }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
      },
      {
          "constant": true,
          "inputs": [
              {
                  "name": "_owner",
                  "type": "address"
              }
          ],
          "name": "balanceOf",
          "outputs": [
              {
                  "name": "balance",
                  "type": "uint256"
              }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
      },
      {
          "constant": true,
          "inputs": [],
          "name": "symbol",
          "outputs": [
              {
                  "name": "",
                  "type": "string"
              }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
      },
      {
          "constant": false,
          "inputs": [
              {
                  "name": "_to",
                  "type": "address"
              },
              {
                  "name": "_value",
                  "type": "uint256"
              }
          ],
          "name": "transfer",
          "outputs": [
              {
                  "name": "",
                  "type": "bool"
              }
          ],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "function"
      },
      {
          "constant": true,
          "inputs": [
              {
                  "name": "_owner",
                  "type": "address"
              },
              {
                  "name": "_spender",
                  "type": "address"
              }
          ],
          "name": "allowance",
          "outputs": [
              {
                  "name": "",
                  "type": "uint256"
              }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
      },
      {
          "payable": true,
          "stateMutability": "payable",
          "type": "fallback"
      },
      {
          "anonymous": false,
          "inputs": [
              {
                  "indexed": true,
                  "name": "owner",
                  "type": "address"
              },
              {
                  "indexed": true,
                  "name": "spender",
                  "type": "address"
              },
              {
                  "indexed": false,
                  "name": "value",
                  "type": "uint256"
              }
          ],
          "name": "Approval",
          "type": "event"
      },
      {
          "anonymous": false,
          "inputs": [
              {
                  "indexed": true,
                  "name": "from",
                  "type": "address"
              },
              {
                  "indexed": true,
                  "name": "to",
                  "type": "address"
              },
              {
                  "indexed": false,
                  "name": "value",
                  "type": "uint256"
              }
          ],
          "name": "Transfer",
          "type": "event"
      }
  ]
    if (tokenAddress) {
      const erc20 = new ethers.Contract(tokenAddress, abi, provider);
      const balance =  await erc20.balanceOf(address)
      value = +ethers.formatEther(balance) * 1
    } else {
      const balance =  await provider.getBalance(address);
      value = +ethers.formatEther(balance) * price
    }

    let rank = 'Shrimp'
    let threshold = 0
    if (value > 1000) {
      rank = 'Dolphin'
      threshold = 1000
    }
    if (value > 10000){
      rank = 'Whale'
      threshold = 10000
    }
    const rankProof = await generateProof(Math.round(value), threshold);
    const hash = crypto.createHash('sha256').update(JSON.stringify(rankProof)).digest('hex');

    await ProofModel.create({
      rank,
      hash,
      tokenAddress: tokenAddress?tokenAddress: 'ETH',
      proof: JSON.stringify(rankProof)
    })
    res.send({
      rank,
      proof: rankProof
    })
  } catch (error) {
    console.log(error)
    res.send({
      e: error,
    });
  }
});

app.get("/:hash", async (req, res) => {
    try {
      let { hash } = req.params;
      console.log(hash)
      const proof = await ProofModel.findOne({hash})
      res.send(proof)
    } catch (error) {
      console.log(error)
      res.send({
        e: error,
      });
    }
  });
connectDB();
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));