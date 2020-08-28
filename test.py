import firebase_admin
from firebase_admin import credentials, db, firestore, messaging
import os
import requests
import json
import threading
import time

cred = credentials.Certificate('./rutgers-course-tracker-firebase-adminsdk-7pvr2-00983f5cf0.json')

# initialize the firebase admin app with a database URL
app = firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://rutgers-course-tracker.firebaseio.com/'
})

db = firestore.client()

callback_done = threading.Event()

# Create a callback on_snapshot function to capture changes
def on_snapshot(doc_snapshot, changes, read_time):
    for doc in doc_snapshot:
        print(f'Received document snapshot: {doc.id}')
    callback_done.set()

doc_ref = db.collection("trackers").where("active", "==", True)

# Watch the document
doc_watch = doc_ref.on_snapshot(on_snapshot)

while True:
    time.sleep(5)
    print("running")