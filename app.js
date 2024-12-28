require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const basicAuth = require('express-basic-auth');
const compression = require('compression');
const fs = require('fs');
const nodemailer = require('nodemailer');
const helmet = require('helmet');

require('events').EventEmitter.defaultMaxListeners = 15;

const app = express();

console.log('Email config:', {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS ? '***exists***' : '***missing***'
});

// Admin authentication
const adminAuth = basicAuth({
    users: { 
        [process.env.ADMIN_USER]: process.env.ADMIN_PASS 
    },
    challenge: true, // This forces the authentication prompt
    realm: 'Bozic Express Admin'
});

// Port configuration
const port = process.env.PORT || 3003;

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (!file.originalname.match(/\.(pdf|doc|docx)$/)) {
            return cb(new Error('Only PDF and Word documents are allowed!'));
        }
        cb(null, true);
    }
});

// Database setup with better error handling
const db = new sqlite3.Database('applications.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        db.run(`CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstName TEXT,
            lastName TEXT,
            email TEXT,
            phone TEXT,
            driverType TEXT,
            experience INTEGER,
            cdlLicense TEXT,
            resumePath TEXT,
            message TEXT,
            submitDate DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating applications table:', err);
            } else {
                console.log('Applications table created successfully');
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company TEXT,
            name TEXT,
            email TEXT,
            phone TEXT,
            serviceType TEXT,
            loadType TEXT,
            commodity TEXT,
            weight TEXT,
            pickupLocation TEXT,
            pickupDate TEXT,
            pickupTime TEXT,
            deliveryLocation TEXT,
            deliveryDate TEXT,
            deliveryTime TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating quotes table:', err);
            } else {
                console.log('Quotes table created successfully');
            }
        });
    }
});


db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='quotes'", (err, row) => {
    if (err) {
        console.error('Error checking database:', err);
    } else {
        console.log('Database check result:', row);
        if (!row) {
            console.log('Quotes table does not exist - will be created');
        } else {
            console.log('Quotes table exists');
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(compression());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'"],
        },
    },
}));
app.use('/views', express.static(path.join(__dirname, 'views')));

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


const sendNotificationEmail = async (type, data) => {
    let subject, htmlContent;

    if (type === 'career') {
        subject = 'New Job Application Received!';
        htmlContent = `
            <h2>New Job Application from Website</h2>
            <p><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
            <p><strong>Experience:</strong> ${data.experience} years</p>
            <p><strong>License Type:</strong> ${data.licenseType}</p>
            <p><strong>Additional Info:</strong> ${data.additionalInfo || 'None provided'}</p>
        `;
    } else if (type === 'quote') {
        subject = 'New Quote Request Received!';
        htmlContent = `
            <h2>New Quote Request from Website</h2>
            <p><strong>Company:</strong> ${data.company}</p>
            <p><strong>Contact Name:</strong> ${data.name}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
            <p><strong>Service Type:</strong> ${data.serviceType}</p>
            <p><strong>Pickup Location:</strong> ${data.pickupLocation}</p>
            <p><strong>Delivery Location:</strong> ${data.deliveryLocation}</p>
            <p><strong>Additional Details:</strong> ${data.details || 'None provided'}</p>
        `;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: subject,
        html: htmlContent
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`${type} notification email sent successfully`);
        return true;
    } catch (error) {
        console.error(`Error sending ${type} email:`, error);
        return false;
    }
};

// Add this route handler for job applications
app.post('/submit-application', upload.single('resume'), async (req, res) => {
    console.log('Received application:', req.body);
    console.log('File:', req.file);

    try {
        // Insert the application into the database
        const sql = `
            INSERT INTO applications (
                firstName, 
                lastName, 
                email, 
                phone, 
                driverType, 
                experience, 
                cdlLicense,
                resumePath,
                message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            req.body.firstName,
            req.body.lastName,
            req.body.email,
            req.body.phone,
            req.body.driverType,
            req.body.experience,
            req.body.cdlLicense,
            req.file ? req.file.filename : null,
            req.body.message || ''
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ 
                    error: 'Database error', 
                    details: err.message 
                });
            }

            // Try to send email notification
            try {
                // Email configuration
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: process.env.EMAIL_USER, // Send to yourself
                    subject: 'New Job Application Received',
                    html: `
                        <h2>New Job Application</h2>
                        <p><strong>Name:</strong> ${req.body.firstName} ${req.body.lastName}</p>
                        <p><strong>Email:</strong> ${req.body.email}</p>
                        <p><strong>Phone:</strong> ${req.body.phone}</p>
                        <p><strong>Driver Type:</strong> ${req.body.driverType}</p>
                        <p><strong>Experience:</strong> ${req.body.experience} years</p>
                        <p><strong>CDL License:</strong> ${req.body.cdlLicense}</p>
                        <p><strong>Message:</strong> ${req.body.message || 'No message provided'}</p>
                    `
                };

                if (req.file) {
                    mailOptions.attachments = [{
                        filename: req.file.originalname,
                        path: req.file.path
                    }];
                }

                transporter.sendMail(mailOptions);
            } catch (emailError) {
                console.error('Email notification failed:', emailError);
                // Continue even if email fails
            }

            res.redirect('/application-success.html');
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Server error', 
            details: error.message 
        });
    }
});

// Admin route with error handling
app.get('/admin', adminAuth, (req, res) => {
    console.log('Admin authentication successful');
    console.log('Current directory:', __dirname);
    
    const adminPath = path.join(__dirname, 'views', 'admin.html');
    console.log('Attempting to serve:', adminPath);
    
    // Check if file exists
    if (!fs.existsSync(adminPath)) {
        console.error('Admin file not found at:', adminPath);
        return res.status(404).send('Admin page not found');
    }
    
    res.sendFile(adminPath, (err) => {
        if (err) {
            console.error('Error sending admin file:', err);
            res.status(500).send('Error loading admin page');
        } else {
            console.log('Admin file sent successfully');
        }
    });
});

// API endpoint to get applications
app.get('/api/applications', adminAuth, (req, res) => {
    console.log('Fetching applications...');
    db.all('SELECT * FROM applications ORDER BY submitDate DESC', [], (err, rows) => {
        if (err) {
            console.error('Error fetching applications:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log('Applications found:', rows);
        res.json(rows);
    });
});

// Get all quotes
app.get('/api/quotes', adminAuth, (req, res) => {
    console.log('Fetching quotes...');
    db.all('SELECT * FROM quotes ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error('Error fetching quotes:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log('Quotes found:', rows);
        res.json(rows);
    });
});

// Delete a quote
app.delete('/api/quotes/:id', basicAuth, (req, res) => {
    db.run('DELETE FROM quotes WHERE id = ?', req.params.id, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Quote deleted successfully' });
    });
});

// Update your quote request route with better error handling
app.post('/submit-quote', async (req, res) => {
    try {
        console.log('Received quote request:', req.body);

        // Validate required fields
        if (!req.body.name || !req.body.email || !req.body.phone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Use parameterized query to prevent SQL injection
        const sql = `
            INSERT INTO quotes (
                company, name, email, phone, serviceType, loadType,
                commodity, weight, pickupLocation, pickupDate, pickupTime,
                deliveryLocation, deliveryDate, deliveryTime, details
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            req.body.company || '',
            req.body.name,
            req.body.email,
            req.body.phone,
            req.body.serviceType || '',
            req.body.loadType || '',
            req.body.commodity || '',
            req.body.weight || '',
            req.body.pickupLocation || '',
            req.body.pickupDate || '',
            req.body.pickupTime || '',
            req.body.deliveryLocation || '',
            req.body.deliveryDate || '',
            req.body.deliveryTime || '',
            req.body.details || ''
        ];

        console.log('SQL Query:', sql);
        console.log('Parameters:', params);

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ 
                    error: 'Database error', 
                    details: err.message 
                });
            }

            console.log('Quote inserted successfully');
            res.json({ 
                message: 'Quote submitted successfully',
                quoteId: this.lastID 
            });
        });

        // Add email notification
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'New Quote Request',
            html: `
                <h2>New Quote Request</h2>
                <p><strong>Company:</strong> ${req.body.company}</p>
                <p><strong>Contact Name:</strong> ${req.body.name}</p>
                <p><strong>Email:</strong> ${req.body.email}</p>
                <p><strong>Phone:</strong> ${req.body.phone}</p>
                <p><strong>Service Type:</strong> ${req.body.serviceType}</p>
                <p><strong>Load Type:</strong> ${req.body.loadType}</p>
                <p><strong>Commodity:</strong> ${req.body.commodity}</p>
                <p><strong>Weight:</strong> ${req.body.weight}</p>
                <h3>Pickup Details:</h3>
                <p><strong>Location:</strong> ${req.body.pickupLocation}</p>
                <p><strong>Date:</strong> ${req.body.pickupDate}</p>
                <p><strong>Time:</strong> ${req.body.pickupTime}</p>
                <h3>Delivery Details:</h3>
                <p><strong>Location:</strong> ${req.body.deliveryLocation}</p>
                <p><strong>Date:</strong> ${req.body.deliveryDate}</p>
                <p><strong>Time:</strong> ${req.body.deliveryTime}</p>
                <p><strong>Additional Details:</strong> ${req.body.details || 'None provided'}</p>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Email error:', error);
            } else {
                console.log('Quote notification email sent');
            }
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Contact form submission route
app.post('/submit-contact', (req, res) => {
    console.log('Form submission received:', req.body); // Debug log

    const { name, email, company, phone, message } = req.body;

    const mailOptions = {
        from: `"${name}" <${process.env.EMAIL_USER}>`,
        replyTo: email,
        to: process.env.EMAIL_USER,
        subject: 'New Contact Form Submission',
        html: `
            <h3>New Contact Message from Website</h3>
            <p><strong>From:</strong> ${name} (${email})</p>
            <p><strong>Company:</strong> ${company || 'Not provided'}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Email Error:', error); // Debug log
            res.status(500).json({ error: 'Failed to send email' });
        } else {
            console.log('Email sent successfully:', info.response); // Debug log
            res.json({ message: 'Email sent successfully' });
        }
    });
});

// Delete an application
app.delete('/api/applications/:id', adminAuth, (req, res) => {
    console.log('Deleting application:', req.params.id);
    db.run('DELETE FROM applications WHERE id = ?', req.params.id, function(err) {
        if (err) {
            console.error('Error deleting application:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log('Application deleted successfully');
        res.json({ message: 'Application deleted successfully' });
    });
});

// Add proper database connection closing
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        }
        process.exit(0);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Also, let's verify the database tables are created correctly
db.serialize(() => {
    console.log('Initializing database...');
    // Keep only the essential table creation code here
    // ... rest of your table creation code ...
});

// Add DELETE routes for both applications and quotes
app.delete('/api/applications/:id', adminAuth, (req, res) => {
    console.log('Deleting application:', req.params.id);
    db.run('DELETE FROM applications WHERE id = ?', req.params.id, function(err) {
        if (err) {
            console.error('Error deleting application:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log('Application deleted successfully');
        res.json({ message: 'Application deleted successfully' });
    });
});

app.delete('/api/quotes/:id', adminAuth, (req, res) => {
    console.log('Deleting quote:', req.params.id);
    db.run('DELETE FROM quotes WHERE id = ?', req.params.id, function(err) {
        if (err) {
            console.error('Error deleting quote:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log('Quote deleted successfully');
        res.json({ message: 'Quote deleted successfully' });
    });
});

