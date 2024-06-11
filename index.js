const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: false }));

// Database connection details
const dbConfig = {
   host: 'bkd9cyjknzoixcjzu6tx-mysql.services.clever-cloud.com',
    user: 'ufozwldzwn5h8kqr',
    password: 'cwzPWMvQvuW2FLfzWWW4',
    database: 'bkd9cyjknzoixcjzu6tx'
};

let db;

// Function to handle connection
function handleDisconnect() {
    db = mysql.createConnection(dbConfig);

    db.connect(err => {
        if (err) {
            console.error('Error connecting to database:', err.stack);
            setTimeout(handleDisconnect, 2000); // Reconnect after 2 seconds
        } else {
            console.log('Connected to database.');
        }
    });

    db.on('error', err => {
        console.error('Database error:', err.stack);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect(); // Reconnect on connection loss
        } else {
            throw err;
        }
    });
}

// Initial connection
handleDisconnect();

// In-memory storage for user data (for simplicity)
let userNames = {};
let voters = new Set(); // Set to track phone numbers that have already voted
let userLanguages = {}; // Object to store the language preference of each user

// Retrieve candidates from database
function getCandidates(callback) {
    const query = 'SELECT name FROM candidates';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error retrieving candidates from database:', err.stack);
            callback([]);
        } else {
            const candidateNames = results.map(candidate => candidate.name);
            callback(candidateNames);
        }
    });
}



app.post('/ussd', (req, res) => {
    let response = '';

    // Extract USSD input
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    // Parse user input
    const userInput = text.split('*').map(option => option.trim());

    // Determine next action based on user input
    if (userInput.length === 1 && userInput[0] === '') {
        // First level menu: Language selection
        response = `CON Welcome to NEC Election System 2024\n`;
        response += `1. English\n`;
        response += `2. Kinyarwanda`;
    } else if (userInput.length === 1 && userInput[0] !== '') {
        // Validate language selection
        if (userInput[0] === '1' || userInput[0] === '2') {
            // Save user's language choice and move to the name input menu
            userLanguages[phoneNumber] = userInput[0] === '1' ? 'en' : 'rw';
            response = userLanguages[phoneNumber] === 'en' ? 
                `CON Please enter your name:` : 
                `CON Andika Amazina yawe:`;
        } else {
            // Invalid language selection
            response = `END Invalid selection. Please try again.` + 
                       `\nIbyo muhisemo Ntibikunze. Ongera Ugerageze.`;
        }
    } else if (userInput.length === 2) {
        // Save user's name
        userNames[phoneNumber] = userInput[1];

       
    } else if (userInput.length === 3) {
        if (userInput[2] === '1' || userInput[2] === '2') {
            isAdmin(phoneNumber, isAdmin => {
                if (userInput[2] === '1') {
                    if (isAdmin) {
                        // Admin viewing votes
                        response = `END Votes:\n`;
                        // Query to get votes from the database
                        const query = 'SELECT voted_candidate, COUNT(*) as vote_count FROM votes GROUP BY voted_candidate';
                        db.query(query, (err, results) => {
                            if (err) {
                                console.error('Error retrieving votes from database:', err.stack);
                                response += `Error retrieving votes.`;
                            } else {
                                results.forEach(row => {
                                    response += `${row.voted_candidate}: ${row.vote_count} votes\n`;
                                });
                            }
                            res.send(response);
                        });
                        return; // Return to wait for async callback
                    } else {
                        // Check if the phone number has already voted
                        if (voters.has(phoneNumber)) {
                            response = userLanguages[phoneNumber] === 'en' ? 
                                `END You have already voted. Thank you!` : 
                                `END Waratoye. Murakoze!`;
                        } else {
                            // Retrieve candidates from database
                            getCandidates(candidateNames => {
                                response = userLanguages[phoneNumber] === 'en' ? 
                                    `CON Select a candidate:\n` : 
                                    `CON Hitamo umukandida:\n`;

                                candidateNames.forEach((candidate, index) => {
                                    response += `${index + 1}. ${candidate}\n`;
                                });

                                res.send(response);
                            });
                            return; // Return to wait for async callback
                        }
                    }
                } else if (userInput[2] === '2') {
                    // View information option selected
                    const userName = userNames[phoneNumber];
                    const userLanguage = userLanguages[phoneNumber];
                    const query = 'SELECT voted_candidate FROM votes WHERE phone_number = ?';
                    db.query(query, [phoneNumber], (err, results) => {
                        if (err) {
                            console.error('Error retrieving user information from database:', err.stack);
                            response = userLanguage === 'en' ? 
                                `END Error retrieving your information.` : 
                                `END Ikosa ryo kubona amakuru yawe.`;
                        } else {
                            const votedCandidate = results.length > 0 ? results[0].voted_candidate : 'None';
                            response = userLanguage === 'en' ? 
                                `END Your Information:\nPhone: ${phoneNumber}\nName: ${userName}\nVoted Candidate: ${votedCandidate}` : 
                                `END Amakuru yawe:\nTelefone: ${phoneNumber}\nIzina: ${userName}\nUmukandida watoye: ${votedCandidate}`;
                        }
                        res.send(response);
                    });
                    return; // Return to wait for async callback
                }
                res.send(response);
            });
            return; // Return to wait for async callback
        } else {
            // Invalid main menu selection
            response = userLanguages[phoneNumber] === 'en' ? 
                `END Invalid selection. Please try again.` : 
                `END Ibyo muhisemo Ntibikunze. Ongera ugerageze.`;
        }
    } else if (userInput.length === 4) {
        // Fourth level menu: Voting confirmation
        let candidateIndex = parseInt(userInput[3]) - 1;

        getCandidates(candidateNames => {
            if (candidateIndex >= 0 && candidateIndex < candidateNames.length) {
                const selectedCandidate = candidateNames[candidateIndex];
                voters.add(phoneNumber); // Mark this phone number as having voted
                response = userLanguages[phoneNumber] === 'en' ? 
                    `END Thank you for voting ${selectedCandidate}!` : 
                    `END Murakoze gutora, Mutoye Umukandida ${selectedCandidate}!`;

                // Insert voting record into the database
                const timestamp = new Date();
                const voteData = {
                    session_id: sessionId,
                    phone_number: phoneNumber,
                    user_name: userNames[phoneNumber],
                    language_used: userLanguages[phoneNumber],
                    voted_candidate: selectedCandidate,
                    voted_time: timestamp
                };

                const query = 'INSERT INTO votes SET ?';
                db.query(query, voteData, (err, result) => {
                    if (err) {
                        console.error('Error inserting data into database:', err.stack);
                    }
                });

                res.send(response);
            } else {
                response = userLanguages[phoneNumber] === 'en' ? 
                    `END Invalid selection. Please try again.` : 
                    `END Ibyo muhisemo Ntibikunze. Ongera ugerageze.`;
                res.send(response);
            }
        });
        return; // Return to wait for async callback
    } else {
        // Catch-all for any other invalid input
        response = userLanguages[phoneNumber] === 'en' ? 
            `END Invalid selection. Please try again.` : 
            `END Ibyo muhisemo Ntibikunze. Ongera ugerageze.`;
    }

    res.set("Content-Type", "text/plain");
    res.send(response);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
