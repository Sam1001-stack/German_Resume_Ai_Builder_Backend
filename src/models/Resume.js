const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    personalInfo: {
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      country: String,
    },
    summary: String,
    experience: [
      {
        company: String,
        position: String,
        startDate: String,
        endDate: String,
        description: String,
      },
    ],
    education: [
      {
        institution: String,
        degree: String,
        startDate: String,
        endDate: String,
      },
    ],
    skills: [String],
    languages: [
      {
        name: String,
        level: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", resumeSchema);
