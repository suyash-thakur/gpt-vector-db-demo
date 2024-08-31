const fs = require('fs');

const openAI = require('openai');

const { Pinecone } = require('@pinecone-database/pinecone');

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
    model: 'text-embedding-3-small',
    dimensions: 1024,
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
  await index.upsert(embeddingsToUpload);
}

const findSimilar = async (index, vector) => {
  const requestQuery = {
    vector,
    topK: 1,
    includeValues: false,
    includeMetadata: true,
  }

  const response = await index.query(requestQuery);
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





const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const pineconeIndexName = process.env.PINE_CONE_INDEX;

const pineConeNameSpace = process.env.PINE_CONE_NAMESPACE;

const start = async () => {

  const index = await pinecone.index(pineconeIndexName).namespace(pineConeNameSpace);

  // await cleanWikipediaText();
  // const embeddings = await createEmbeddingForChunks();
  // await uploadEmbeddings(embeddings, index);
  const question = `Who is Virat kohli father`;
  const questionEmbedding = await createOpenAIEmbeddings(question);
  console.log(questionEmbedding.data[0].embedding);
  const similarVectors = await findSimilar(index, questionEmbedding.data[0].embedding);
  console.dir({ similarVectors }, { depth: null });
  const gptResponse = await createOpenAIResponse(question, similarVectors.matches[0].metadata.text);
  console.log(gptResponse);

};

start();