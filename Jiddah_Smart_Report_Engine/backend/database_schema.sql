-- Database Schema for School Report System

-- Students table
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    class VARCHAR(50) NOT NULL
);

-- Circular results table (English subjects)
CREATE TABLE circular_results (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    mot_mark DECIMAL(5,2),
    eot_mark DECIMAL(5,2),
    grade VARCHAR(10),
    remark VARCHAR(255),
    teacher_initials VARCHAR(10)
);

-- Theology results table (Arabic subjects)
CREATE TABLE theology_results (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    subject VARCHAR(50) NOT NULL CHECK (subject IN ('Quran', 'Fiqh', 'Tarbiya', 'Arabic')),
    mot_score DECIMAL(5,2),
    eot_score DECIMAL(5,2)
);

-- Supabase storage buckets for report assets
-- Create the following buckets in Supabase storage if they do not exist:
--   signatures  (public)
--   documents   (public)
-- If your project uses Supabase CLI migrations, create these buckets there or via the Supabase dashboard.
