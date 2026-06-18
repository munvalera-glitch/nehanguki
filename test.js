const action = "";
const applicant = {
    surname: "A",
    givenNames: "B",
    fullName: "A B",
    nationality: "C",
    passportNumber: "D",
    passportIssueDate: "E",
    passportExpiryDate: "F",
    phone: "G",
    isStudent: false
};

const isApplicantValid = () => {
    const baseValid = applicant.fullName && applicant.nationality && applicant.passportNumber && applicant.passportIssueDate && applicant.passportExpiryDate && applicant.phone;
    if (action !== "address_change") {
        if (applicant.isStudent === null) return false;
        if (applicant.isStudent && !applicant.schoolName) return false;
    }
    return baseValid;
};

console.log(isApplicantValid());
