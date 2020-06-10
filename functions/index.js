const functions = require('firebase-functions');
const admin = require('firebase-admin');
const app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://rutgers-course-tracker.firebaseio.com/'
});
const { firestoreCourseData } = require('./firestoreCourseData.js');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.scheduledFunction = functions.pubsub.schedule('every 24 hours').onRun(context => {
	console.log("context:",context);
    firestoreCourseData( admin.firestore() );
    return null;
});

// Take the text parameter passed to this HTTP endpoint and insert it into 
// Cloud Firestore under the path /messages/:documentId/original
// exports.addMessage = functions.https.onRequest(async (req, res) => {
// 	// Grab the text parameter.
// 	const original = req.query.text;
// 	// Push the new message into Cloud Firestore using the Firebase Admin SDK.
// 	const writeResult = await admin.firestore().collection('messages').add({original: original});
// 	// Send back a message that we've succesfully written the message
// 	res.json({result: `Message with ID: ${writeResult.id} added.`});
// });