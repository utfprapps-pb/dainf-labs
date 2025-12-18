pipeline {
    agent any

    environment {        
        SPRING_PROFILES_ACTIVE="prod"

        API_HOST_PORT=8150
        API_CONTAINER_PORT=8150
        
        CLIENT_HOST_PORT=8151
        CLIENT_CONTAINER_PORT=80

        POSTGRESQL_CRED = credentials('postgres-id')
        DATABASE_URL="jdbc:postgresql://postgresql:5432/od46s_test_labs"
        DATABASE_USERNAME="${POSTGRESQL_CRED_USR}"
        DATABASE_PASSWORD="${POSTGRESQL_CRED_PSW}"
        
        EMAIL_CRED = credentials('od46s-test-labs-email-id')
        MAIL_HOST="smtp.gmail.com"
        MAIL_PORT=587
        MAIL_USERNAME="${EMAIL_CRED_USR}"
        MAIL_PASSWORD="${EMAIL_CRED_USR}"

        MINIO_CRED = credentials('dainf_labs_minio_id')
        MINIO_URL="https://minio.app.pb.utfpr.edu.br"
        MINIO_BUCKET="od46s-test-labs"
        MINIO_ACCESS_KEY="${MINIO_CRED_USR}"
        MINIO_SECRET_KEY="${MINIO_CRED_PSW}"
        MINIO_SECURE=true
        MINIO_PORT=443

        API_HOST_URL="od46s-test-labs-api.app.pb.utfpr.edu.br"
        API_URL="https://od46s-test-labs-api.app.pb.utfpr.edu.br/api"
        CLIENT_HOST_URL="od46s-test-labs.app.pb.utfpr.edu.br"
        CLIENT_URL="https://od46s-test-labs.app.pb.utfpr.edu.br"
    }

    stages {   
        stage('Build via Docker Compose') {
            steps {
                sh 'docker compose --profile app up -d --build'
            }
        }
    }
}