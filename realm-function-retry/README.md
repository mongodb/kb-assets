# Motivation

This tutorial is born to show how we can create a retry mechanism for our functions. We have to keep in mind that triggers have their own internal automatic retry mechanism that ensures that they are executed. However, functions lack such a mechanism. Realm functions are executed as HTTP requests, so if they fail it is our responsibility to create a mechanism to retry. 

Next, we will show how we can achieve this mechanism in a simple way that could be applied to any project. 

# Flow diagram

The main basis of this mechanism will be based on states. In this way we will be able to contemplate 4 different states. Thus, we will have:

1. **0: Not tried**. Initial state. When creating a new event that will need to be processed, it will be assigned the initial **status 0**.
2. **1: Success**: Successful status. When an event is successfully executed through our function, it will be assigned this status so that it will not be necessary to retry again. 
3. **2: Failed**: Failed status. When after executing an event it resolves in error, it will be necessary to retry and therefore it will be assigned a status **2 or failed**.
4. **3: Error**: It is important to note that we cannot always retry. We must have a limit of retries, when this limit is exhausted, the status will change to **error or 3**.

The algorithm that will define the passage between states, will be the following: 

![](https://i.ibb.co/QfWntch/triggers-queue-Diagrama-comportamiento.jpg)

# System architecture

The system is based on two collections and a trigger. The trigger will be defined as a database trigger that will react each time there is an insert or update in a specific collection. The collection will keep track of the events that need to be processed. Each time this trigger is activated, the event is processed in a function linked to it. The function, when processing the event, may or may not fail and we need to capture the failure to retry.

When the function fails, the event state is updated in the `Events` collection, and as the trigger reacts on inserts and updates, it will call the function again to reprocess the same.

A maximum number of retries will be defined so that, once exhausted, the event will not be reprocessed and will be marked as an error in the `Error` collection.   

# 
Sequence diagram

The following diagram shows the three use cases contemplated for this scenario. 

### Use case 1: 
A new document is inserted in the collection of events to be processed. Its initial state is **0** (new) and the number of retries is **0**. The trigger is activated and executes the function for this event. The function is executed successfully and the event status is updated to **1 (success)**.

### Use case 2: 
A new document is inserted into the collection of events to be processed. Its initial state is **0 (new)** and the number of retries is **0**. The trigger is activated and executes the function for this event. The function fails and the event status is updated to **2 (failed)** and the number of retries is increased to **1**.

### Use case 3:
A document is updated in the collection of events to be processed. Its initial status is **2** (failed) and the number of retries is less than the maximum allowed. The trigger is activated and executes the function for this event. The function fails, the status remains at **2 (failed)** and the counter increases. If the counter for retries is greater than the maximum allowed, the event is sent to the `Error` collection and deleted from the `Events` collection. 

### Use case 4:
A document is updated in the `Events` collection to be processed. Its initial status is **2 (failed)** and the number of retries is less than the maximum allowed. The trigger is activated and executes the function for this event. The function is executed successfully, the status changes to **1** (success).

![](https://i.ibb.co/V9xKKKQ/triggers-queue-Diagrama-de-secuencia.jpg)

# Project example repository

This project uses a trigger: newEventsGenerator to generate a new document every 2 minutes through a cron job in the `Events` collection. This will simulate the creation of events to be processed. 
The trigger eventsProcessor will be in charge of processing the events inserted or updated in the `Events` collection. To simulate a failure, a function is used that generates a random number and returns whether it is divisible or not by 2. In this way, both states can be simulated. 

```javascript
function getFailOrSuccess() {
  // Random number between 1 and 10
  const number = Math.floor(Math.random() * 10) + 1;
  return ((number % 2) === 0);
}
```

# Conclusions

This tutorial illustrates in a simple way how we can create our own retry mechanism to increase the reliability of our application. Realm allows us to create our application completely serverless and thanks to the Realm functions we can define and execute the server-side logic for our application in the cloud. 

We can use the functions to handle low-latency, short-lived connection logic and other server-side interactions. Functions are especially useful when we want to work with multiple services, behave dynamically based on the current user, or abstract the implementation details of our client applications. 

This retry mechanism we have just created will allow us to handle interaction with other services in a more robust way letting us know that, in case of a failure, the action will be reattempted.  