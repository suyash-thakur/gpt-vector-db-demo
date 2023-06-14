# gpt-vector-db-demo

This code is a Node.js script that uses the OpenAI API and Pinecone API to perform various tasks related to text processing, embeddings, and similarity search. The script reads data from a Wikipedia text file, performs cleaning and parsing operations, creates embeddings for the text, uploads the embeddings to a Pinecone index, and provides chat-based responses to user questions based on the indexed data.

## Prerequisites

Before running the script, make sure you have the following:
- Node.js installed on your machine.
- An OpenAI API key.
- A Pinecone API key.
- A Pinecone index name.
- A Pinecone namespace.

## Installation

1. Clone or download the code from the repository.
2. Install the required dependencies by running the following command in the project directory:

```shell 
npm install 
```

## Configure

update the following environment variables:

- OPENAI_API_KEY: Set your OpenAI API key.
- PINE_CONE_API_KEY: Set your Pinecone API key.
- PINE_CONE_INDEX: Set your Pinecone index name.
- PINE_CONE_NAMESPACE: Set your Pinecone namespace.
- PINE_CONE_ENVIRONMENT: Set the environment for Pinecone (e.g., 'us-west1').

Make sure to save the changes to the .env file.

## Usage

To run the script, execute the following command:
```shell
node index.js
```
The script performs the following tasks: 

1. eads the Wikipedia text from the `wikipedia.txt` file, cleans the text, and saves the cleaned version to the `clean-wikipedia.txt` file.
2. Parses the cleaned text and creates an array of objects containing the parsed lines.
3. Creates embeddings for each parsed line and uploads them to the Pinecone index.
4. Prompts the user with a question (`Which regions were involved in gallic war ?` in the example) and retrieves similar content from the Pinecone index.
5. Uses the retrieved content as context and the user's question to generate a chat-based response using the OpenAI API.
6. Displays the response in the console.

Note -: The `addEmbeddingToText` function is commented out in the code by default. If you want to re-create the embeddings and update the Pinecone index with new data, uncomment the `await addEmbeddingToText(index)` line in the `start` function.

## Customization

- You can modify the input question (`question`) and adjust the similarity threshold (`match.score > 0.85`) in the `getSimilarContent` function to control the matching behavior.
- You can change the OpenAI model used for chat completion by updating the `model` parameter in the `getChatCompletion` function.
- The Pinecone index configuration can be adjusted by modifying the Pinecone client initialization and the `uploadTranscriptEmbedding` function.
