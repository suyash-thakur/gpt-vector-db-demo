const fs = require('fs');

const openAI = require('openai');

const { PineconeClient } = require('@pinecone-database/pinecone');

const dotenv = require('dotenv');

dotenv.config();


const openai = new openAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const readWikipediaText = async (isClean = false) => {
  let wikipediaText;
  if (isClean) {
    wikipediaText = fs.readFileSync('./clean-wikipedia.txt', 'utf8');
  } else {
    wikipediaText = fs.readFileSync('./wikipedia.txt', 'utf8');
  }
  return wikipediaText;
};

const cleanWikipediaText = async () => {
  const wikipediaText = await readWikipediaText();
  const lines = wikipediaText.split('\n');
  const cleanLines = lines.map((line) => {
    const cleanLine = line.replace(/[^a-zA-Z ]/g, "").toLocaleLowerCase();
    return cleanLine;
  });
  const cleanText = cleanLines.join('\n');
  await fs.writeFileSync('./clean-wikipedia.txt', cleanText);
};


const createChunk = async () => {
  const CHUNK_SIZE = 6;
  const wikipediaText = await readWikipediaText(true);
  const lines = wikipediaText.split('\n').filter((line) => line.length > 0)
  const chunks = [];

  for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
    const chunk = lines.slice(i, i + CHUNK_SIZE);
    chunks.push(chunk.join('\n'));
  }

  return chunks;

}

const createOpenAIEmbeddings = async (chunk) => {
  const embeddings = await openai.embeddings.create({
    input: chunk,
    model: 'text-embedding-ada-002',
  });
  return embeddings;
};

const createEmbeddingForChunks = async () => {
  const chunks = await createChunk();
  const embeddings = [];

  for (const chunk of chunks) {
    const embedding = await createOpenAIEmbeddings(chunk);
    embeddings.push({
      chunk,
      embedding,
    });
  }


  return embeddings;
};

const uploadEmbeddings = async (embeddings, index) => {
  const embeddingsToUpload = [];
  for (let i = 0; i < embeddings.length; i += 1) {
    const embedding = embeddings[i];
    embeddingsToUpload.push({
      id: `vec_${i}`,
      values: embedding.embedding.data[0].embedding,
      metadata: {
        text: embedding.chunk,
      },
    });
  }
  console.log(embeddingsToUpload);
  await index.upsert({
    upsertRequest: {
      vectors: embeddingsToUpload,
      namespace: pineConeNameSpace,
    },
  });
}

const findSimilar = async (index, vector) => {
  const requestQuery = {
    vector,
    topK: 3,
    includeValues: false,
    includeMetadata: true,
    namespace: pineConeNameSpace,
  }

  const response = await index.query({ queryRequest: requestQuery });
  return response;
};

const createOpenAIResponse = async (question, context) => {
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: `Based on the provided context here give the answer to the question \n ${context}` },
      { role: 'user', content: question },
    ],
    model: 'gpt-3.5-turbo',
  });
  return chatCompletion.choices;
};





const pinecone = new PineconeClient();

const pineconeIndexName = process.env.PINE_CONE_INDEX;

const pineConeNameSpace = process.env.PINE_CONE_NAMESPACE;

const pineConeApiKey = process.env.PINE_CONE_API_KEY;





const start = async () => {
  await pinecone.init({
    environment: process.env.PINE_CONE_ENVIRIONMENT,
    apiKey: process.env.PINE_CONE_API_KEY,
  });
  const index = await pinecone.Index(pineconeIndexName);

  // await cleanWikipediaText();
  // const embeddings = await createEmbeddingForChunks();
  // await uploadEmbeddings(embeddings, index);
  const question = `WHat is virat kohli's wife name`;
  const questionEmbedding = await createOpenAIEmbeddings(question);
  // console.log(questionEmbedding.data[0].embedding);
  const similarVectors = await findSimilar(index, questionEmbedding.data[0].embedding);
  console.dir({ similarVectors }, { depth: null });
  const gptResponse = await createOpenAIResponse(question, similarVectors.matches[0].metadata.text);
  console.log(gptResponse);

};

start();