const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sequelize = require('./config/database');
const User = require('./models/user');
const History = require('./models/history');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Like = require('./models/like');
const Group = require('./models/group');
const Message = require('./models/message');
const Added = require('./models/added');
const Style = require('./models/style');
const Competition = require("./models/competition");
const Competitor = require("./models/competitor");

const app = express();
const PORT = 3000;
const HF_API_TOKEN = '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';

const IMAGE_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR);
}

sequelize.sync().then(() => {
  console.log('Database & tables created!');
});

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use('/images', express.static(IMAGE_DIR));

function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  console.log('Token received:', token); 
  if (!token) return res.status(403).send({ auth: false, message: 'No token provided.' });
  jwt.verify(token.split(' ')[1], 'secret', (err, decoded) => { 
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
    }
    req.userId = decoded.id;
    next();
  });
};

app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).send('User already exists.');
    }
    const hashedPassword = bcrypt.hashSync(password, 8);
    await User.create({ username, email, password: hashedPassword });
    res.status(201).send('User registered successfully.');
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('Error registering user.');
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).send('User not found.');

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) return res.status(401).send({ auth: false, token: null });

    const token = jwt.sign({ id: user.id }, 'secret', { expiresIn: 86400 });
    res.status(200).send({ auth: true, token });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).send('Error logging in.');
  }
});

app.post('/api/history', verifyToken, async (req, res) => {
  const { style, room, color } = req.body;
  try {
    await History.create({
      style,
      room,
      color,
      userId: req.userId,
    });
    res.status(201).send('History record saved.');
  } catch (error) {
    console.error('Error saving history:', error);
    res.status(500).send('Error saving history.');
  }
});

app.post('/api/images', verifyToken, async (req, res) => {
  try {
    const latestHistory = await History.findOne({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']],
    });

    if (!latestHistory) {
      console.log('No history found for user:', req.userId);
      return res.status(404).json({ error: 'No history found.' });
    }

    const prompt = `Generate a realistic image of a ${latestHistory.room} in ${latestHistory.style} style with predominant ${latestHistory.color} color tones.`;
    console.log('Prompt being sent to API:', prompt);
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2',
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    if (response.status === 200) {
      const filename = `image_${Date.now()}.png`;
      const filePath = path.join(IMAGE_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(response.data));
      const imageUrl = `http://localhost:${PORT}/images/${filename}`;
      res.json({ image: imageUrl, prompt });
    } else {
      console.error('Error from Hugging Face API:', response.status, response.data);
      return res.status(500).json({ error: 'Failed to generate image: Error from API.' });
    }

  } catch (error) {
    console.error('Error fetching image from Hugging Face:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return res.status(500).json({ error: 'Failed to generate image.' });
  }
});

app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ['username', 'email', 'isDesigner']
    });

    if (!user) {
      return res.status(404).send('User not found.');
    }

    res.status(200).json({ 
      username: user.username, 
      email: user.email, 
      isDesigner: user.isDesigner 
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).send('Error fetching user profile.');
  }
});

app.put('/api/profile', verifyToken, async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findByPk(req.userId);

    if (!user) {
      return res.status(404).send('User not found.');
    }

    user.username = username;  
    await user.save();  
    res.status(200).send('Username updated successfully.');

  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).send('Failed to update username.');
  }
});


app.put('/api/profile/designer', verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);

    if (!user) {
      return res.status(404).send('User not found.');
    }

    if (user.isDesigner) {
      return res.status(403).send('Cannot change designer status once set.');
    }

    user.isDesigner = true;
    await user.save();
    res.status(200).send('User is now a designer.');

  } catch (error) {
    console.error('Error updating designer status:', error);
    res.status(500).send('Error updating designer status.');
  }
});

app.post('/api/likes', verifyToken, async (req, res) => {
  const { imageUrl } = req.body;
  console.log('Received like request:', req.body); 
  const userId = req.userId;
  try {
    const like = await Like.create({
      userId: userId,
      imageUrl: imageUrl,
    });
    res.status(201).json({ success: true, like });

  } catch (error) {
    console.error('Error saving like:', error);
    res.status(500).json({ success: false, error: 'Failed to save like.' });
  }
});

app.get('/api/likes', verifyToken, async (req, res) => {
  try {
    const likes = await Like.findAll({
      where: { userId: req.userId },
      attributes: ['id', 'imageUrl', 'likedAt'],
    });
    res.status(200).json(likes);

  } catch (error) {
    console.error('Error fetching liked images:', error);
    res.status(500).send('Failed to fetch liked images.');
  }
});

app.delete('/api/likes/:id', verifyToken, async (req, res) => {
  const likeId = req.params.id;
  try {
    const like = await Like.findOne({ where: { id: likeId, userId: req.userId } });
    
    if (!like) {
      return res.status(404).json({ error: 'Like not found.' });
    }

    await like.destroy();
    res.status(200).json({ success: true, message: 'Like removed successfully.' });

  } catch (error) {
    console.error('Error removing like:', error);
    res.status(500).json({ success: false, error: 'Failed to remove like.' });
  }
});

app.get('/api/history', verifyToken, async (req, res) => {
  try {
    const history = await History.findAll({
      where: { userId: req.userId },
      attributes: ['style', 'room', 'color', 'dateTime'],
      order: [['dateTime', 'DESC']], 
    });
    res.status(200).json(history);

  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).send('Error fetching search history.');
  }
});

app.delete('/api/history/:dateTime', verifyToken, async (req, res) => {
  const { dateTime } = req.params;
  try {
    const result = await History.destroy({
      where: {
        userId: req.userId,
        dateTime: dateTime,
      },
    });
    if (result) {
      res.status(200).send('History entry deleted successfully.');
    } else {
      res.status(404).send('History entry not found.');
    }
  } catch (error) {
    console.error('Error deleting history entry:', error);
    res.status(500).send('Error deleting history entry.');
  }
});

app.post('/api/groups', verifyToken, async (req, res) => {
  const { name } = req.body;
  try {
    const group = await Group.create({ name, userId: req.userId });
    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).send('Error creating group.');
  }
});

app.get('/api/groups', verifyToken, async (req, res) => {
  try {
    const groups = await Group.findAll();
    res.status(200).json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).send('Error fetching groups.');
  }
});

app.post('/api/groups/:groupId/messages', verifyToken, async (req, res) => {
  const { text } = req.body;
  const { groupId } = req.params;
  try {
    const message = await Message.create({
      text,
      userId: req.userId,
      groupId,
    });
    res.status(201).json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).send('Error adding message.');
  }
});

app.get('/api/groups/:groupId/messages', verifyToken, async (req, res) => {
  const { groupId } = req.params;
  try {
    const messages = await Message.findAll({
      where: { groupId },
      include: [{ model: User, attributes: ['username'] }],
      order: [['createdAt', 'ASC']],
      raw: true
    });
    console.log('Messages fetched:', messages); 
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).send('Error fetching messages.');
  }
});

app.post('/api/upload', verifyToken, async (req, res) => {
  try {
    console.log('Received body:', req.body);

    if (!req.body.file || !req.body.filename) {
      return res.status(400).json({ error: 'No file data or filename provided.' });
    }

    const { file, filename } = req.body;
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
    const fileExtension = path.extname(filename).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({ error: 'Invalid file type.' });
    }

    const uniqueFilename = `upload_${Date.now()}${fileExtension}`;
    const filePath = path.join(IMAGE_DIR, uniqueFilename);
    const fileBuffer = Buffer.from(file, 'base64');
    fs.writeFileSync(filePath, fileBuffer);
    const imageUrl = `http://localhost:${PORT}/images/${uniqueFilename}`;
    const added = await Added.create({
      url: imageUrl,
      userId: req.userId,
    });

    res.status(201).json({ success: true, imageUrl, added });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file.' });
  }
});

app.get('/api/uploaded-images', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; 
    const images = await Added.findAll({
      where: { userId },
      attributes: ['id', 'url', 'createdAt'], 
      order: [['createdAt', 'DESC']], 
    });

    res.status(200).json(images);
  } catch (error) {
    console.error('Error fetching user images:', error);
    res.status(500).json({ error: 'Failed to fetch user images.' });
  }
});

app.get('/api/designers', verifyToken, async (req, res) => {
  try {
    const designers = await User.findAll({
      where: { isDesigner: true },
      attributes: ['id', 'username', 'email'] 
    });
    res.status(200).json(designers);
  } catch (error) {
    console.error('Error fetching designers:', error);
    res.status(500).send('Error fetching designers.');
  }
});

app.get('/api/images/:designerId', verifyToken, async (req, res) => {
  const designerId = parseInt(req.params.designerId, 10);

  if (!designerId || isNaN(designerId)) {
    return res.status(400).json({ error: "Invalid designer ID." });
  }

  try {
    const images = await Added.findAll({
      where: { userId: designerId },
      attributes: ['id', 'url', 'createdAt'],
    });
    res.status(200).json(images);
  } catch (error) {
    console.error("Error fetching designer images:", error);
    res.status(500).json({ error: "Failed to fetch designer images." });
  }
});

app.post('/api/save-quiz-result', verifyToken, async (req, res) => {
  const { style } = req.body;
  try {
    await Style.create({
      userId: req.userId,
      style
    });
    res.status(201).send("Quiz result saved successfully.");
  } catch (error) {
    console.error("Error saving quiz result:", error);
    res.status(500).send("Failed to save quiz result.");
  }
});

app.get('/api/get-quiz-result', verifyToken, async (req, res) => {
  try {
    const results = await Style.findAll({
      where: { userId: req.userId }
    });
    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching quiz results:", error);
    res.status(500).send("Failed to fetch quiz results.");
  }
});

app.post("/api/competitions", verifyToken, async (req, res) => {
  const { name, date, image } = req.body;

  if (!name || !date || !image) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    await Competition.create({
      name,
      date,
      image,
      userId: req.userId,
    });

    res.status(201).json("Competition saved successfully!");
  } catch (error) {
    console.error("Error creating competition:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.get("/api/competitions", async (req, res) => {
  try {
    const competitions = await Competition.findAll();
    res.status(200).json(competitions);
  } catch (error) {
    console.error("Error fetching competitions:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.post('/api/competitions/:id/join', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  const { description } = req.body;  

  try {
    const competition = await Competition.findByPk(id);
    if (!competition) {
      return res.status(404).json({ message: "Competition not found" });
    }

    const existingCompetitor = await Competitor.findOne({
      where: { userId, competitionId: id }
    });
    if (existingCompetitor) {
      return res.status(400).json({ message: "User already joined the competition" });
    }

    const newCompetitor = await Competitor.create({
      userId,
      competitionId: id,
      description: description, 
    });

    res.status(201).json(newCompetitor);
  } catch (error) {
    console.error("Error joining competition:", error);
    res.status(500).json({ message: "Error joining competition" });
  }
});

app.get('/api/competitions/:competitionId/descriptions', async (req, res) => {
  const { competitionId } = req.params;

  try {
      const descriptions = await Competitor.findAll({
          where: { competitionId },
          include: {
              model: User,
              attributes: ['username'], 
          },
      });

      res.status(200).json(descriptions);
  } catch (error) {
      console.error('Error fetching competition descriptions:', error);
      res.status(500).json({ message: 'Failed to fetch descriptions.' });
  }
});

app.post("/api/competitions/:id/pick-winner", async (req, res) => {
  const { id } = req.params;
  const { winner } = req.body;
  try {
    const competition = await Competition.findByPk(id);
    if (!competition) {
      return res.status(404).json({ message: "Competition not found" });
    }
    competition.winner = winner;
    await competition.save();
    res.status(200).json({ message: "Winner selected successfully" });
  } catch (error) {
    console.error("Error picking winner:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/api/descriptions/:id', async (req, res) => { 
  try { const description = await Competitor.findByPk(req.params.id, { include: [User] }); 
  if (!description) { return res.status(404).json({ message: 'Description not found' }); 
} res.status(200).json(description); 
} catch (error) { console.error('Error fetching description:', error); 
  res.status(500).json({ message: 'Internal server error' }); 
} });

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
