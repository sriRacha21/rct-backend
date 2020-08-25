import firebase_admin
from firebase_admin import credentials, db, firestore
import os
import requests
import json
from time import sleep

#constants
baseSubjectsURI = "https://sis.rutgers.edu/oldsoc/subjects.json"
baseCoursesURI = "http://sis.rutgers.edu/oldsoc/courses.json"
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


# Helper functions
def getSeasonFromFile():
    return

# main function for updating firestore

def firestoreCourseData(db):
    #https://sis.rutgers.edu/oldsoc/subjects.json?semester=92020&campus=NB&level=U
    requestURI = f'{baseSubjectsURI}?semester={9}{2020}&campus=NB&level=U'
    print("Requesting URI:", requestURI)
    print("hi")

    res = None
    try:
        res = requests.get(requestURI)
    except:
        print("SOC API Connection error.")
        return

    subjects = json.loads(res.text)

    indexMap = {}

    # Going through the subjects to get request all the courses in that subject
    for x in subjects:

        code = x['code']
        requestCoursesURI = f'{baseCoursesURI}?subject={code}&semester={9}{2020}&campus=NB&level=U'
        try:
            res = requests.get(requestCoursesURI)
        except:
            print("SOC API Connection error.")
            continue

        courses = json.loads(res.text)

        # Going through the courses in the subject
        for course in courses:
            sections = course['sections']
            title = course['title']
            subject = course['subject']
            courseNumber = course['courseNumber']
            # going through the sections in the course
            for section in sections:
                index = section['index']
                sectionNumber = section['number']

                indexMap[index] = {
                    'subject': subject,
                    'name': title,
                    'secion': sectionNumber,
                    'course': courseNumber
                }

        print(indexMap['15402'])
        break
        # sleep(2)

firestoreCourseData(firestore.client())

