const fs = require('fs');
const file = 'src/ImmigrationMVP.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix double click in handlePortOnePayment
if (!content.includes('const paymentInProgressRef = useRef(false);')) {
  content = content.replace(
    'const [paymentProcessing, setPaymentProcessing] = useState(false);',
    'const [paymentProcessing, setPaymentProcessing] = useState(false);\n  const paymentInProgressRef = useRef(false);'
  );
}

content = content.replace(
  'const handlePortOnePayment = async (paymentAmount) => {\n    try {\n      setPaymentProcessing(true);',
  'const handlePortOnePayment = async (paymentAmount) => {\n    if (paymentInProgressRef.current) return;\n    try {\n      paymentInProgressRef.current = true;\n      setPaymentProcessing(true);'
);

content = content.replace(
  'setPaymentProcessing(false);\n      }\n    } catch (err) {',
  'setPaymentProcessing(false);\n        paymentInProgressRef.current = false;\n      }\n    } catch (err) {'
);

content = content.replace(
  'setPaymentModalOpen(false);\n    }\n  }',
  'setPaymentModalOpen(false);\n      paymentInProgressRef.current = false;\n    }\n  }'
);

fs.writeFileSync(file, content);
