exports = async function() {
  
  const event = context.services.get('mongodb-atlas').db('Retries').collection('Events');
  
  const body = {
    "state": 0,
    "count": 0,
    "timestamp" : new Date()
  };
  
  return await event.insertOne(body);
  
};
