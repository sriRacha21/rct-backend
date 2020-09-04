const fs = require('fs');

const seasons = {
    SPRING: 'spring',
    WINTER: 'winter',
    FALL: 'fall',
    SUMMER: 'summer'
}

function getSeasonFromFile(path) {
    // get file contents
    let fileContents; 
    try {
        fileContents = fs.readFileSync(path).toString();
    } catch( err ) {
        console.error(`Not able to read file located at: ${path}. Error: ${err}`);
        return;
    }

    // determine whether the file contains fall or spring
    const possSeasons = [seasons.SPRING, seasons.FALL];
    let season = "";
    possSeasons.forEach( possSeason => {
        if( season == "" && fileContents.includes(possSeason) )
            season = possSeason;
    }) 

    // if no season was found print and exit
    if( season == "" ) {
        console.error(`Seasons ${possSeasons} were not found in file!`);
        process.exit();
    }
    // return if a season was found
    return season;
}

module.exports = { getSeasonFromFile };