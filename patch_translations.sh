#!/bin/bash
sed -i.bak -e '/"app.uploadBtn": "Загрузить"/a\
  ,"action.next_occupation": "Далее к месту работы"\
  ,"action.next_acc_options": "Далее к согласию владельца"
' src/i18n/locales/ru.js

sed -i.bak -e '/"app.uploadBtn": "Upload"/a\
  ,"action.next_occupation": "Next to occupation"\
  ,"action.next_acc_options": "Next to provider consent"
' src/i18n/locales/en.js

sed -i.bak -e '/"app.uploadBtn": "업로드"/a\
  ,"action.next_occupation": "다음 - 직장 정보"\
  ,"action.next_acc_options": "다음 - 숙소 제공자 동의서"
' src/i18n/locales/ko.js
