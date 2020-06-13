#!/usr/bin/env node
const admin = require('firebase-admin');
const app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://rutgers-course-tracker.firebaseio.com/'
});
const bent = require('bent');
const getJSON = bent('json');
// constants
const baseCoursesURI = "http://sis.rutgers.edu/oldsoc/courses.json";
// every 30 seconds
const repeatRate = 30000; 
// dictionary
const intSeason = {
    'winter': 0,
    'spring': 1,
    'summer': 7,
    'fall': 9
}

// this function checks if a user's class is open and notifies them if it is
async function checkNotify( db ) {
    // loop over all active users
    const usersSnapshot = await db
        .collection("users")
        .get();
    
    // stop if collection is empty
    if( usersSnapshot.empty ) {
        console.warn("No users in collection.");
        return;
    }
    // find rToken in each document, if it exists go to trackers coll
    usersSnapshot.forEach(async doc => {
        const uid = doc.get("user")
        const rToken = doc.get("rToken");
        if( !uid || !rToken ) return;
        // get the tracker doc with that uid
        const trackersSnapshot = await db
            .collection("trackers")
            .where("active", "==", true)
            .where("user", "==", uid)
            .get();
        if( trackersSnapshot.empty ) return;
        // for each course that that user is tracking, check if the course is open and send the notification if it is
        trackersSnapshot.forEach(async trackerDoc => {
            const subject = trackerDoc.get("subject");
            const semester = trackerDoc.get("semester");
            const year = trackerDoc.get("createdTime").toDate().getUTCFullYear() + (semester.toLowerCase() == "spring" ? 1 : 0);
            const index = trackerDoc.get("index");
            const course = trackerDoc.get("courseNumber");
            const courseName = trackerDoc.get("course");
            // query SOC
            const requestURI = `${baseCoursesURI}?subject=${subject}&semester=${intSeason[semester]}${year}&campus=NB&level=UG`;
            console.log(`Requesting URI: ${requestURI}`);
            const courses = await getJSON(requestURI);
            const chosenCourse = courses.find(c => c.courseNumber == course);
            if( !chosenCourse ) {
                console.error(`Course ${course} could not be found for user ${uid}.`);
                return;
            }
            // get section by index
            if( !chosenCourse.sections ) return;
            const chosenSection = chosenCourse.sections.find(s => s.index == index);
            if( !chosenSection ) return;
            // if section is open notify user
            if( chosenSection.openStatus ) {
                admin.messaging().send({
                    data: {
                        index: index.toString(),
                        year: year.toString(),
                        sem: intSeason[semester].toString()
                    }, android: {
                        notification: {
                            sound: "default"
                        },
                        priority: "normal"
                    }, apns: {
                        payload: {
                            aps: {
                                badge: 1,
                                sound: "default"
                            },
                        },
                    }, notification: {
                        title: `${courseName} (${index}) is now open!`,
                        body: "Tap to open WebReg",
                    },
                    token: rToken
                })
                .then((response) => {
                    // Response is a message ID string.
                    console.log('Successfully sent message:', response);
                    // turn doc active to false
                    trackerDoc.ref.update({
                        active: false
                    })
                })
                .catch((error) => {
                    console.log('Error sending message:', error);
                });
            }
        });
    });

    // run again in 30 seconds
    setTimeout( checkNotify, repeatRate, db )
}

// run
checkNotify( admin.firestore() );