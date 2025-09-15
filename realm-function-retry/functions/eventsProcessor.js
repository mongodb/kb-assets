exports = async function(changeEvent) {
  
  //console.log(JSON.stringify(changeEvent));
  
  const event = context.services.get('mongodb-atlas').db('Retries').collection('Events');
  const error = context.services.get('mongodb-atlas').db('Retries').collection('Error');
  const attempts = context.values.get("Attempts");

  // Get the state of the event inserted or updated
  const { operationType } = changeEvent;
  const { _id } = changeEvent.documentKey;
  
  var state;
  var count;
  
  if (operationType === "insert") {
    // When there is an insert we receive the fullDocument
    state = changeEvent.fullDocument.state;
    count = changeEvent.fullDocument.count;
  } else if (operationType === "update") {
    // We need to query the document to access the properties
    const d = await event.find({
      "_id": BSON.ObjectId(`${_id}`)
    }).toArray()
    .then(d => {
      return (d != null && d.length > 0) ? d[0] : null;
    })
    .catch(e => {
      console.error(`Can't find an event with id ${id}, error: ${e}`);
      return null;
    });
    if (d === null) return;
    state = d.state;
    count = d.count;
  }
  
  /* state: 
  *  0: new
  *  1: success
  *  2: fail
  *  3: error
  * We are going to run the event when is new or need to retry it.
  */
  if (state == 0 || state == 2 ) {
    // All the attempts are exhausted?
    if (count > attempts) {
      await error.insertOne({
        "id": _id,
        "state": 3,
        "count": count
      })
      .then(d => {
        event.deleteOne({
          "_id": BSON.ObjectId(`${_id}`)
        });
      });
    } else {
      // This will replicate a success/fail request
      const success = getFailOrSuccess();
      if (success) {
        console.log("Event was succesfull");
        // The request was succesfull 
        await event.updateOne({
          "_id": BSON.ObjectId(`${_id}`)
        },{
          "$set": {
            "state": 1
          }
        });
      } else {
        console.log("Event failed");
        await event.updateOne({
          "_id": BSON.ObjectId(`${_id}`)
        },{
          "$set": {
            "state": 2
          },
          "$inc": {
            "count" : 1
          }
        });
      }
    }
  }
  
  
  /* This function will return true or false
  *  simulating a fail or success requests
  *  to assign a value to the executed function
  */
  function getFailOrSuccess() {
    // Random number between 1 and 10
    const number = Math.floor(Math.random() * 10) + 1;
    return ((number % 2) === 0);
  }
  
  
};
