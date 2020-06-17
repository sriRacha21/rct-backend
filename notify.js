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
// determine if time is in non-check range
const SOCnonUpdate = (date) => { return date.getHours() >= 2 && (date.getHours() < 6 || (date.getHours() == 6 && date.getMinutes() <= 30)); }
// dictionary
const intSeason = {
    'winter': 0,
    'spring': 1,
    'summer': 7,
    'fall': 9
}
// user snapshots CollectionReference and lock flag
let trackersSnapshot;
let trackersSnapshotLock = false;

// this function populates the userssnapshot obj
async function populateSnapshot( db ) {
    trackersSnapshot = await db
        .collection("trackers")
        .where("active", "==", true)
        .get();
}

// listen to updates on the collection
admin.firestore()
    .collection("trackers")
    .where("active", "==", true)
    .onSnapshot(querySnapshot => {
        // if there is a lock on the trackers snapshot (the collection is being iterated through) do not update it.
        if( trackersSnapshotLock ) return;
        console.log("User event listener fired.");
        trackersSnapshot = querySnapshot;
    });

async function checkNotify( db ) {
    // don't check at 2:00 - 6:30 since SOC does not update at this time
    const now = new Date();
    if( SOCnonUpdate(now) ) return;

    console.log("Started checkNotify.");
    // loop over active trackers, which has already been populated
    trackersSnapshot.forEach(async trackerDoc => {
        // lock the trackers snapshot so they can't be updated while they are being iterated through
        trackersSnapshotLock = true; 
        // gather relevant fields
        const subject = trackerDoc.get("subject");
        const semester = trackerDoc.get("semester");
        const year = trackerDoc.get("createdTime").toDate().getUTCFullYear() + (semester.toLowerCase() == "spring" ? 1 : 0);
        const index = trackerDoc.get("index");
        const course = trackerDoc.get("courseNumber");
        const courseName = trackerDoc.get("course");
        const uid = trackerDoc.get("user");
        // query SOC
        const requestURI = `${baseCoursesURI}?subject=${subject}&semester=${intSeason[semester]}${year}&campus=NB&level=UG`;
        console.log(`Requesting URI: ${requestURI}`);
        let courses;
        try {
            courses = await getJSON(requestURI);
        } catch( e ) {
            console.error("SOC API Connection error:", e);
            return;
        }
        const chosenCourse = courses.find(c => c.courseNumber == course);
        if( !chosenCourse ) {
            console.error(`Course ${course} could not be found for user ${uid}.`);
            return;
        }
        // get section by index
        if( !chosenCourse.sections ) return;
        const chosenSection = chosenCourse.sections.find(s => s.index == index);
        if( !chosenSection ) return;
        // if the section isn't open return
        if( !chosenSection.openStatus ) return;
        // find users that match the uid from the trackerdoc
        const usersSnapshot = await db
            .collection("users")
            .where("user", "==", uid)
            .limit(1)
            .get();
        usersSnapshot.forEach(async userDoc => {
            // get relevant fields
            const rToken = userDoc.get("rToken");
            // send course open notif
            sendOpenCourseNotif({
                // messaging service
                messaging: admin.messaging(),
                // token to send notification
                rToken: rToken,
                // course information
                courseName: courseName,
                index: index,
                year: year,
                semester: semester,
                // document to turn to false
                trackerDoc: trackerDoc
            });
        })
    })
    // unlock the flag
    trackersSnapshotLock = false;
    // start the function again in 30 seconds
    setTimeout( checkNotify, repeatRate, db );
}

// send the notification
async function sendOpenCourseNotif({ messaging, rToken, courseName, index, year, semester, trackerDoc }) {
    messaging.send({
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
                    // badge: 1,
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

// run
(async () => {
    await populateSnapshot( admin.firestore() );
    await checkNotify( admin.firestore() );
})();
