const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });

jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: mockSendMail }),
}));

// require after mock so the module-level createTransport picks up our mock
const email = require('../email');

describe('email module', () => {
  beforeEach(() => {
    mockSendMail.mockClear();
  });

  describe('sendVerificationEmail', () => {
    it('calls sendMail with correct recipient and subject', async () => {
      await email.sendVerificationEmail('user@test.com', 'Alice', 'tok123');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('user@test.com');
      expect(call.subject).toMatch(/vérif/i);
      expect(call.html).toContain('Alice');
      expect(call.html).toContain('tok123');
    });
  });

  describe('sendLiveSessionEmail', () => {
    it('includes course name and professor in the email', async () => {
      await email.sendLiveSessionEmail('s@t.com', 'Bob', 'Algo', 'Prof X', 42);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('s@t.com');
      expect(call.subject).toContain('Algo');
      expect(call.html).toContain('Prof X');
      expect(call.html).toContain('Bob');
    });
  });

  describe('sendAnnouncementEmail', () => {
    it('truncates long content to 120 chars preview', async () => {
      const longContent = 'A'.repeat(200);
      await email.sendAnnouncementEmail('s@t.com', 'Bob', 'Title', longContent, 'Author');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('A'.repeat(120) + '…');
    });

    it('does not truncate short content', async () => {
      await email.sendAnnouncementEmail('s@t.com', 'Bob', 'Title', 'Short', 'Author');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('Short');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('includes the reset token link', async () => {
      await email.sendPasswordResetEmail('u@t.com', 'Alice', 'reset_tok_abc');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('u@t.com');
      expect(call.html).toContain('reset_tok_abc');
    });
  });

  describe('sendGradeEmail', () => {
    it('shows grade out of 20', async () => {
      await email.sendGradeEmail('s@t.com', 'Alice', 'HW1', 15, 'Good job');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('15/20');
      expect(call.html).toContain('Good job');
    });

    it('shows "Non notée" when grade is null', async () => {
      await email.sendGradeEmail('s@t.com', 'Alice', 'HW1', null, '');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('Non notée');
    });
  });

  describe('sendNewDevoirEmail', () => {
    it('includes devoir title and professor name', async () => {
      await email.sendNewDevoirEmail('s@t.com', 'Bob', 'TP Final', 'Dr. Smith');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toContain('TP Final');
      expect(call.html).toContain('Dr. Smith');
    });
  });

  describe('sendSubmissionEmail', () => {
    it('notifies professor about student submission', async () => {
      await email.sendSubmissionEmail('prof@t.com', 'ProfA', 'StudentB', 'HW2');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('prof@t.com');
      expect(call.html).toContain('StudentB');
      expect(call.html).toContain('HW2');
    });
  });

  describe('sendFileUploadEmail', () => {
    it('includes filename and course info', async () => {
      await email.sendFileUploadEmail('s@t.com', 'Bob', 'notes.pdf', 'Math', 'Prof', 1);

      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toContain('Math');
      expect(call.html).toContain('notes.pdf');
    });
  });
});
