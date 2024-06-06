const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create a pool of database connections
const pool = mysql.createPool({
    host: 'bmbbgh2kkgtsluvxgsgg-mysql.services.clever-cloud.com',
    user: 'ukfxzd7xalsto9w1',
    password: 'Izp4BXbvKMzJQM3URrRD',
    database: 'bmbbgh2kkgtsluvxgsgg',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const userVotes = {};

app.post('/ussd', (req, res) => {
    const {
        sessionId,
        serviceCode,
        phoneNumber,
        text,
    } = req.body;

    let response = '';

    if (!userVotes[phoneNumber]) {
        userVotes[phoneNumber] = {
            voted: false,
            language: null,
            candidate: null,
        };
    }

    if (userVotes[phoneNumber].voted) {
        response = 'END You have already voted. Thank you!';
    } else {
        if (text === '') {
            response = `CON Please choose your language
            1. KIN
            2. ENG`;
        } else if (text === '1') {
            userVotes[phoneNumber].language = 'KIN';
            response = `CON HITAMO UMUKANDIDA
            1. PAUL KAGAME
            2. FRANK HABINEZA
            3. BARAFINDA`;
        } else if (text === '2') {
            userVotes[phoneNumber].language = 'ENG';
            response = `CON Choose your candidate
            1. PAUL KAGAME
            2. FRANK HABINEZA
            3. BARAFINDA`;
        } else if (['1*1', '1*2', '1*3', '2*1', '2*2', '2*3'].includes(text)) {
            const candidateID = text.split('*')[1];
            userVotes[phoneNumber].candidate = candidateID;

            let candidateName = '';
            switch(candidateID) {
                case '1':
                    candidateName = 'PAUL KAGAME';
                    break;
                case '2':
                    candidateName = 'FRANK HABINEZA';
                    break;
                case '3':
                    candidateName = 'BARAFINDA';
                    break;
            }

            response = userVotes[phoneNumber].language === 'KIN' ? 
                `CON WAHISEMO ${candidateName}. EMEZA UGUKORA
                1. Yego
                2. Oya` : 
                `CON You selected ${candidateName}. Confirm your vote
                1. Yes
                2. No`;
        } else if (['1*1*1', '1*2*1', '1*3*1', '2*1*1', '2*2*1', '2*3*1'].includes(text)) {
            userVotes[phoneNumber].voted = true;
            response = userVotes[phoneNumber].language === 'KIN' ? 
                'END WAHISEMO UMUKANDIDA. MURAKOZE!' : 
                'END You have voted. Thank you!';
        } else if (['1*1*2', '1*2*2', '1*3*2', '2*1*2', '2*2*2', '2*3*2'].includes(text)) {
            response = userVotes[phoneNumber].language === 'KIN' ? 
                'END MWABAYE MWANZE GUTORA. MURAKOZE!' : 
                'END You have canceled your vote. Thank you!';
        } else if (text.toLowerCase() === 'check') {
            // Check voted candidates
            const votedCandidate = userVotes[phoneNumber].candidate;
            if (votedCandidate) {
                let candidateName = '';
                switch(votedCandidate) {
                    case '1':
                        candidateName = 'PAUL KAGAME';
                        break;
                    case '2':
                        candidateName = 'FRANK HABINEZA';
                        break;
                    case '3':
                        candidateName = 'BARAFINDA';
                        break;
                }
                response = `END You have voted for ${candidateName}.`;
            } else {
                response = 'END You have not voted yet.';
            }
        } else {
            response = userVotes[phoneNumber].language === 'KIN' ? 
                'END IBYO WAHISEMO SIBYO. MWONGERE MUGERAGEZE.' : 
                'END Invalid option. Please try again.';
        }
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
