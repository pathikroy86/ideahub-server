const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT || 8008;
const uri = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const db = client.db("ideahub");
        const ideascollection = db.collection("startupIdeas");

        app.get('/ideas', async (req, res) => {
            const result = await ideascollection.find().toArray();
            console.log(result);
            res.json(result);
        })

        app.post('/ideas', async (req, res) => {
            const ideasData = req.body;
            const result = await ideascollection.insertOne(ideasData);
            res.json(result);
        })

        app.get('/ideas/:id', async (req, res) => {
            const { id } = req.params;
            const result = await ideascollection.findOne({ _id: new ObjectId(id), });
            res.json(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

run().catch(console.dir);