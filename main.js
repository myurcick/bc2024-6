const {program} = require('commander');
const express = require("express");
const app = express();
const fs = require('fs').promises; 
const fsSync = require('fs')
const path = require('path');
const http = require('http');
const multer = require("multer");
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

program
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії, яка міститиме закешовані файли');

program.parse(process.argv);

const options = program.opts();
app.use(express.json());
app.use(express.text());

const file  = fsSync.readFileSync('./openapi.yaml', 'utf8')
const swaggerDocument = YAML.parse(file)

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));



app.get('/notes/:noteName', (req, res) => {
  const noteName = req.params.noteName;

  const filePath = path.join(options.cache, noteName + ".json");
  fs.readFile(filePath)
  .then(content=>{
    let jsonData = JSON.parse(content);
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(200);
    res.end(jsonData.note);
  })
  .catch(err=>{
    console.log('No such note: ' + err);
    res.writeHead(404);
    res.end('Note not found');
  });
});

app.put('/notes/:noteName', async (req, res) => {
  const noteName = req.params.noteName;
  const note = req.body;
  const jsonData = `{
    "note_name" : "${noteName}",
    "note" : "${note}"
  }`;

  const filePath = path.join(options.cache, noteName + ".json");

  try {
    await fs.access(filePath);
    console.log('File exists');

    await fs.writeFile(filePath, jsonData);
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(200);
    res.end(note);

  } catch (err) {
    console.log("Error: " + err.message);
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Cannot edit note, file does not exist');
    } else {
      res.writeHead(500);
      res.end('Internal server error');
    }
  }
});

app.delete('/notes/:noteName', (req, res) =>{
  const noteName = req.params.noteName;
  const filePath = path.join(options.cache, noteName + ".json");
  fs.unlink(filePath)
  .then(()=>{
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(200);
    res.end('Note deleted successfully.');
  })
  .catch((err) =>{
    console.error('No such note: ' + err);
    res.writeHead(404);
    res.end('Note not found');
  });
});

app.get('/notes', async (req, res) => {
  let jsonData = [];
  const dirPath = path.join(options.cache);

  try {
    const notes = await fs.readdir(dirPath);

    for (const note of notes) {
      const filePath = path.join(dirPath, note);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const jsonNote = JSON.parse(content); 
        jsonData.push({ name: jsonNote.note_name, text: jsonNote.note });
      } catch (err) {
        console.log('Error reading file:', err);
      }
    }
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(jsonData));

  } catch (err) {
    console.error('Error reading directory:', err);
    res.writeHead(404);
    res.end();
  }
});

const storage = multer.memoryStorage();  
const upload = multer({ storage: storage }); 

//upload.none() - for text-only multipart form
app.post("/write", upload.none(), async (req, res) => {
  const noteName = req.body.note_name;
  const note = req.body.note;
  const filePath = path.join(options.cache, noteName + ".json");

  const jsonData = `{
    "note_name" : "${noteName}",
    "note" : "${note}"
  }`;

  try {
    await fs.access(filePath);
    res.writeHead(400);
    return res.end('Нотатка з таким ім’ям вже існує.');
    } 
  catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(filePath, jsonData);
      res.writeHead(201);
      return res.end('Нотатка створена.');
    }
    console.log('Error checking file:', err);
    return res.status(500).send('Помилка при створенні нотатки.');
  }
});

app.get('/UploadForm.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile('/usr/src/app/UploadForm.html');
});


const server = http.createServer(app);

server.listen(options.port, options.host, (error) => {
  if (error) return console.log(`Error: ${error}`);
  console.log(`Server is listening on http://${options.host}:${options.port}`);
});