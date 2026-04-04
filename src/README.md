# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Log in with role-based access control
- Sign up for activities
- Unregister students with permission checks

## Getting Started

1. Install the dependencies:

   ```
   pip install -r ../requirements.txt
   ```

2. Run the application:

   ```
   python app.py
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/auth/me`                                                        | Get the current authenticated user                                  |
| POST   | `/auth/login`                                                     | Log in and receive a session cookie                                 |
| POST   | `/auth/logout`                                                    | Log out and clear the session cookie                                |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| POST   | `/activities/{activity_name}/signup`                              | Sign up a student for an activity                                   |
| DELETE | `/activities/{activity_name}/unregister?email=student@...`        | Unregister a student from an activity                               |

## Role Model

- `student`: can sign up and unregister only their own email address.
- `club_leader`: can manage registrations for any student.
- `admin`: can manage registrations for any student.

Protected write actions return `401` when not logged in and `403` when the signed-in user does not have permission for the requested student email.

## Sample Accounts

These accounts are stored in [src/users.json](users.json):

- `teacher@mergington.edu` / `teacher123` (`admin`)
- `advisor@mergington.edu` / `leader123` (`club_leader`)
- `emma@mergington.edu` / `student123` (`student`)
- `olivia@mergington.edu` / `student123` (`student`)

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

3. **Users** - Stored in `users.json`:
   - Name
   - Email
   - Password
   - Role

Activity registrations and login sessions are still stored in memory, which means they reset when the server restarts.
