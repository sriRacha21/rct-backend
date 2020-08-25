import firebase_admin
from firebase_admin import credentials, db, firestore
import os
import requests
import json
from time import sleep
import datetime

#constants
baseSubjectsURI = "https://sis.rutgers.edu/oldsoc/subjects.json"
baseCoursesURI = "http://sis.rutgers.edu/oldsoc/courses.json"
seasonInt = {
    'winter': 0,
    'spring': 1,
    'summer': 7,
    'fall': 9
}
intSeason = {
    0: 'winter',
    1: 'spring',
    7: 'summer',
    9: 'fall'
}
year = datetime.datetime.now().year

# credentials
cred = credentials.Certificate('./rutgers-course-tracker-firebase-adminsdk-7pvr2-00983f5cf0.json')

# initialize the firebase admin app with a database URL
app = firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://rutgers-course-tracker.firebaseio.com/'
})


# Helper functions

## Get Semeseter from file
def getSemesterFromFile():
    return

## Cleaner wrap of using map function

def returnValueDictionary(indexMap: dict, value: str) -> dict:
    return dict(map(lambda kv: (kv[0], kv[1][value]), indexMap.items()))

# main function for updating firestore

def firestoreCourseData(db, season: int):
    #https://sis.rutgers.edu/oldsoc/subjects.json?semester=92020&campus=NB&level=U
    isSpring = season == 1
    currentYear = year

    if isSpring:
        currentYear +=1

    requestURI = f'{baseSubjectsURI}?semester={season}{currentYear}&campus=NB&level=U'
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
        requestCoursesURI = f'{baseCoursesURI}?subject={code}&semester={season}{currentYear}&campus=NB&level=U'
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
                    'section': sectionNumber,
                    'course': courseNumber
                }

        break
        # sleep(2)
    updateFirestore(indexMap, intSeason[season])

def updateFirestore(indexMap: dict, season: str):
    db = firestore.client()
    seasonColl = db.collection(season)

    seasonColl.document("sections").set({
        'sections' : returnValueDictionary(indexMap, 'section')
        })

    seasonColl.document("names").set({
        'names' : returnValueDictionary(indexMap, 'name')
        })

    seasonColl.document("subjects").set({
        'subjects' : returnValueDictionary(indexMap, 'subject')
        })

    seasonColl.document("courses").set({
        'courses' : returnValueDictionary(indexMap, 'course')
        })


def enter():
    f = open("season.txt", "r")
    sem = f.readline().rsplit('\n')[0]
    f.close()

    seasons = [9, 7] if sem == 'fall' else [1, 0];

    for season in seasons:
        firestoreCourseData(firestore.client(), season)

enter()