import firebase_admin
from firebase_admin import credentials, db, firestore, messaging
import os
import requests
import json
# typing
from typing import List

# constants
baseCoursesURI = 'https://sis.rutgers.edu/soc/api/courses.gzip'
baseOpenSectionsURI = 'https://sis.rutgers.edu/soc/api/openSections.gzip'
intSeason = {
    'winter': 0,
    'spring': 1,
    'summer': 7,
    'fall': 9
}

# credentials
cred = credentials.Certificate('./rutgers-course-tracker-firebase-adminsdk-7pvr2-00983f5cf0.json')

# initialize the firebase admin app with a database URL
app = firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://rutgers-course-tracker.firebaseio.com/'
})

# 
# res = requests.get('{}?year=2020&term=9&campus=NB'.format(baseCoursesURI))
# classes = res.json()

def checkNotify( db ):
    trackersSnapshot = db.collection("trackers").where("active", "==", True).get()

    seen = False
    for trackerDoc in trackersSnapshot:
        if seen:
            return
        seen = True
        # get all fields
        subject = trackerDoc.get("subject")
        semester = trackerDoc.get("semester")
        year = trackerDoc.get("createdTime").year
        index = trackerDoc.get("index")
        course = trackerDoc.get("courseNumber")
        courseName = trackerDoc.get("course")
        uid = trackerDoc.get("user")
        # query SOC
        requestURI = f'{baseOpenSectionsURI}?year={year}&term={intSeason[semester]}&campus=NB'
        print("Requesting URI:", requestURI)
        # try to query the URL
        res = None
        try:
            res = requests.get(requestURI)
        except:
            print("SOC API Connection error.")
            return
        openSections = listToDict(json.loads(res.text))
        # guard clause for class not open
        if index not in openSections:
            return
        # get users
        usersSnapshot = db.collection("users").where("user", "==", uid).limit(1).get()
        for userDoc in usersSnapshot:
            rToken = userDoc.get("rToken")
            sendNotif( rToken, courseName, index, year, semester, trackerDoc )

    # courses = db.collection("fall").document("courses").get().to_dict()["courses"]
    # print("courses:", courses)
def sendNotif( rToken, courseName, index, year, semester, trackerDoc ):
    message = messaging.Message(
        data = {
            'index': index,
            'year': str(year),
            'sem': str(intSeason[semester])
        },
        apns = messaging.APNSConfig(
            payload = messaging.APNSPayload(
                aps = messaging.Aps(sound="default")
            )
        ),
        notification = messaging.Notification(
            title = f'{courseName} ({index}) is now open!',
            body = "Tap to open WebReg"
        ),
        token = rToken
    )
    try:
        res = messaging.send( message )
        print("Message sent:", res)
    except Exception as e:
        print("Exception raised:", e)

def sendTestNotif( rToken ):
    message = messaging.Message(
        apns = messaging.APNSConfig(
            payload = messaging.APNSPayload(
                aps = messaging.Aps(sound="default")
            )
        ),
        notification = messaging.Notification(
            title = f'peepee',
            body = "Tap to poop your pants"
        ),
        token = rToken 
    )
    res = messaging.send( message )
    print("Message sent:", res)

def listToDict( strings: List[str] ) -> dict:
    dictionary = {}
    for string in strings:
        dictionary[string] = True
    return dictionary

checkNotify( firestore.client() )