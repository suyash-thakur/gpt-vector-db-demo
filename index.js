const fs = require('fs');

const OpenAI = require('openai');
const { PineconeClient } = require('@pinecone-database/pinecone');

const dotenv = require('dotenv');

dotenv.config();


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new PineconeClient();

const pineconeIndexName = process.env.PINE_CONE_INDEX;

const pineConeNameSpace = process.env.PINE_CONE_NAMESPACE;


// OpenAI API for chat completion
const getChatCompletion = async ({ messages }) => {
  const config = {
    model: 'gpt-3.5-turbo',
    messages,
  };
  let response;
  try {
    response = await openai.chat.completions.create(config);
    if (response.choices) {
      return response.choices[0].message.content;
    }
  } catch (error) {
    console.log('error', error);
  }
  return '';
};



// OpenAI API for creating embeddings
const createEmbedding = async ({ input }) => {
  const config = {
    model: "text-embedding-ada-002",
    input,
  };

  let response;
  try {
    response = await openai.embeddings.create(config);
    return response.data;
  } catch (error) {
    console.log(error);
  }

  return '';
};

// Pinecone API for uploading embeddings
const uploadTranscriptEmbedding = async ({ index, documents }) => {
  await index.upsert({
    upsertRequest: {
      vectors: documents,
      namespace: pineConeNameSpace,
    }
  });
};



// Clean Wikipedia text
const createCleanFile = async () => {
  const data = await fs.promises.readFile('./wikipedia.txt', 'utf-8');
  const lines = data.split('\n').filter(line => line !== '');
  const cleanLines = lines.map(line => line.replace(/[^a-zA-Z ]/g, "").toLowerCase());
  const cleanText = cleanLines.join('\n');
  await fs.promises.writeFile('./clean-wikipedia.txt', cleanText);
}


// Parse text
const parseText = async () => {
  const parsedLines = [];
  const data = await fs.promises.readFile('./clean-wikipedia.txt', 'utf-8');
  const lines = data.split('\n').filter(line => line !== '');
  for (const line of lines) {
    parsedLines.push({
      text: line,
    });
  }

  return parsedLines;
}

// Create embeddings and upload to Pinecone
const createAndStoreEmbeddings = async ({ lines, index }) => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const embedding = await createEmbedding({ input: line.text });
    const pineconeDocument = {
      id: `vec_${i}`,
      values: embedding[0].embedding,
      metadata: {
        text: line.text,
      }
    };
    await uploadTranscriptEmbedding({ index, documents: [pineconeDocument] });
  }
};

// Add embeddings to text
const addEmbeddingToText = async (index) => {
  const lines = await parseText();
  await createAndStoreEmbeddings({ lines, index });
};

// Get question embedding
const getGetQuestionEmbedding = async (question) => {
  const data = await createEmbedding({ input: question });
  const vector = data[0].embedding;
  return vector;
};

// Find most similar
const findMostSimilar = async (index, vector) => {
  const queryRequest = {
    vector,
    topK: 3,
    includeValues: false,
    includeMetadata: true,
    namespace: pineConeNameSpace,
  }

  try {
    const queryResponse = await index.query({ queryRequest });
    console.dir({ queryResponse }, { depth: null });
    return queryResponse;
  } catch (e) {
    console.log(e);
  }
};

// Get similar content
const getSimilarContent = async (index, question) => {
  const vector = await getGetQuestionEmbedding(question);
  const response = await findMostSimilar(index, vector);
  let matchResponse = response.matches.filter(match => match.score > 0.85).map(match => match.metadata.text).join('\n');
  if (matchResponse.length === 0 && response.matches.length > 0) {
    matchResponse = response.matches[0].metadata.text;
  }
  return matchResponse;
}

// Get chat response
const getChatResponse = async ({
  question,
  content
}) => {
  const messages = [
    {
      role: 'system',
      content: `You are a chat assistant. The extract below is from Wikipedia. Answer the question accordingly. Don't deviate outside of the context provided ${content}`,
    },
    {
      role: 'user',
      content: question,
    },
  ];
  const response = await getChatCompletion({ messages });
  return response;
}

const start = async () => {

  await pinecone.init({
    environment: process.env.PINE_CONE_ENVIRIONMENT,
    apiKey: process.env.PINE_CONE_API_KEY,
  });
  const index = await pinecone.Index(pineconeIndexName);
  await addEmbeddingToText(index);
  const question = `Which regions were involved in gallic war ?`;
  const content = await getSimilarContent(index, question);
  const response = await getChatResponse({
    question,
    content,
  });
  console.log('response -:', response);
};

start();