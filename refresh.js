#!/usr/bin/env node
// imports
const fs = require('fs');
const bent = require('bent');
const prettyMs = require('pretty-ms');
const { getSeasonFromFile } = require('./seasonFromFile.js');

const admin = require('firebase-admin');

var serviceAccount = require("/root/rct-backend/rutgers-course-tracker-firebase-adminsdk-7pvr2-00983f5cf0.json")

const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://rutgers-course-tracker.firebaseio.com/'
});


// constants
const DEBUG = true;
const baseSubjectsURI = "https://sis.rutgers.edu/oldsoc/subjects.json";
const baseCoursesURI = "http://sis.rutgers.edu/oldsoc/courses.json";
const getJSON = bent('json');
const seasonInt = {
    0: 'winter',
    1: 'spring',
    7: 'summer',
    9: 'fall'
}

// functions
// returns a new object with the values at each key mapped using mapFn(value)
function objectMap(object, mapFn) {
    return Object.keys(object).reduce(function(result, key) {
        result[key] = mapFn(object[key]);
        return result;
    }, {})
}

// main function for updating firestore
async function firestoreCourseData( db ) {
    // variable for checking how long this took
    const before = Date.now();
    // figure out what season and year we're in
    const date = new Date();
    const querySeason = getSeasonFromFile('season.txt');
    const year = date.getFullYear();
    // if fall query fall and summer, if spring query spring and winter
    const seasons = querySeason == "fall" ? [9, 7] : [1, 0];
    // get subjects from SOC
    const subjectRequestArr = seasons.map(season => {
        const isSpring = season == 1; // if the season is spring we need to increment year
        const requestURI = `${baseSubjectsURI}?semester=${season}${year + (isSpring ? 1 : 0)}&campus=NB&level=U`;
        console.log(`Requesting URI: ${requestURI}`);
        return getJSON(requestURI);
    });
    let subjectList;
    try {
        subjectList = (await Promise.all(subjectRequestArr))[0];
    } catch( e ) {
        console.error( "SOC API Connection error:", e );
        process.exit();
    }
    // get courses from SOC
    const courseRequestArr = [];
    subjectList.forEach(subject => {
        seasons.forEach(season => {
            const isSpring = season == 1; // if the season is spring we need to increment year
            const requestURI = `${baseCoursesURI}?subject=${subject.code}&semester=${season}${year + (isSpring ? 1 : 0)}&campus=NB&level=UG`;
            console.log(`Requesting URI: ${requestURI}`);
            courseRequestArr.push({
                promise: getJSON(requestURI),
                season: seasonInt[season]
            });
        })
    })
    console.log("Finished collecting all courses. Attempting to resolve all of them.");
    let subjects = await Promise.all(courseRequestArr.map(rObj => rObj.promise));

    if( !subjects ) {
        console.error("No subjects could be found.");
        process.exit();
    }

    // construct maps for insertion into firestore
    let indexMap = {};
    subjects.forEach( (subject,idx) => {
        subject.forEach(course => {
            if( !course.sections ) {
                console.warn(`Course ${course.title}: ${course.courseNumber} sections were not found. Skipping...`);
                return;
            }
            course.sections.forEach( section => {
                if( !course.subject || !course.title || !section.number || !section.index ) {
                    console.warn(`One or more fields were missing for course ${course.title}, section index ${section.index}, course subject ${course.subject}, section number ${section.number}. Skipping...`);
                    return;
                }

                // construct maps
                if( !indexMap[courseRequestArr[idx].season] ) indexMap[courseRequestArr[idx].season] = {};
                indexMap[courseRequestArr[idx].season][section.index] = {
                    subject: course.subject,
                    name: course.title,
                    section: section.number,
                    course: course.courseNumber
                };
            });
        });
    });

    // write data from maps to firestore
    for( const season in indexMap ) {
        console.log(`Writing data to season ${season}:`, indexMap[season]);
        // get appropriate season doc
        const seasonColl = db
            .collection(season)
        // set sections
        seasonColl
            .doc("sections")
            .set({
                sections: objectMap(indexMap[season], value => value.section)
            })
            .then( writeData => {
                if( DEBUG ) console.log("Wrote sections to firestore successfully:", writeData);
            })
            .catch(err => console.error('Error setting document:', err));
        // set names
        seasonColl
            .doc("names")
            .set({
                names: objectMap(indexMap[season], value => value.name)
            })
            .then( writeData => {
                if( DEBUG ) console.log("Wrote names to firestore successfully:", writeData);
            })
            .catch(err => console.error('Error setting document:', err));
        // set subjects
        seasonColl
            .doc("subjects")
            .set({
                subjects: objectMap(indexMap[season], value => value.subject)
            })
            .then( writeData => {
                if( DEBUG ) console.log("Wrote subjects to firestore successfully:", writeData);
            })
            .catch(err => console.error('Error setting document:', err));
        // set course numbers
        seasonColl
            .doc("courses")
            .set({
                courses: objectMap(indexMap[season], value => value.course)
            })
            .then( writeData => {
                if( DEBUG ) console.log("Wrote course numbers to firestore successfully:", writeData);
            })
            .catch(err => console.error('Error setting document:', err));
    }
    // print out how long it took
    const after = Date.now();
    console.log(`Operation completed in ${prettyMs(after-before)}.`);
}

// run
firestoreCourseData( admin.firestore() );