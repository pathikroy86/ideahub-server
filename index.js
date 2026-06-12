const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require("jose-node-cjs-runtime");

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

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload;
        next();
    } catch (error) {
        return res.status(403).json({ message: "Forbidden" });
    }
};

const getLoggedInUserId = (req) => {
    return req.user?.sub || req.user?.id;
};

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const db = client.db("ideahub");
        const ideascollection = db.collection("startupIdeas");
        const myIdeasCollection = db.collection("myIdeas");

        app.get('/ideas', verifyToken, async (req, res) => {
            const result = await ideascollection.find().toArray();
            res.json(result);
        })

        app.post('/ideas', verifyToken, async (req, res) => {
            const ideasData = {
                ...req.body,
                userId: getLoggedInUserId(req),
                userEmail: req.user?.email,
                userName: req.user?.name,
                createdAt: new Date(),
            };
            const result = await ideascollection.insertOne(ideasData);
            res.json(result);
        })

        app.get('/ideas/:id', verifyToken, async (req, res) => {
            const { id } = req.params;
            const result = await ideascollection.findOne({ _id: new ObjectId(id), });
            res.json(result);
        })

        app.put('/ideas/:id', verifyToken, async (req, res) => {
            const { id } = req.params;
            const userId = getLoggedInUserId(req);
            const updatedIdea = {
                ...req.body,
                updatedAt: new Date(),
            };

            delete updatedIdea._id;
            delete updatedIdea.userId;
            delete updatedIdea.userEmail;
            delete updatedIdea.userName;
            delete updatedIdea.createdAt;

            const result = await ideascollection.updateOne(
                { _id: new ObjectId(id), userId: userId },
                { $set: updatedIdea }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: "Idea not found" });
            }

            res.json(result);
        })

        app.delete('/ideas/:id', verifyToken, async (req, res) => {
            const { id } = req.params;
            const userId = getLoggedInUserId(req);
            const result = await ideascollection.deleteOne({
                _id: new ObjectId(id),
                userId: userId,
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ message: "Idea not found" });
            }

            res.json(result);
        })

        app.get('/myideas/:userId', verifyToken, async (req, res) => {
            const { userId } = req.params;
            const loggedInUserId = getLoggedInUserId(req);

            if (userId !== loggedInUserId) {
                return res.status(403).json({ message: "Forbidden" });
            }

            const result = await ideascollection.find({ userId: userId }).toArray();
            res.json(result);
        })

        app.post('/myideas', async (req, res) => {
            const myideasData = req.body;
            const result = await myIdeasCollection.insertOne(myideasData);
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
