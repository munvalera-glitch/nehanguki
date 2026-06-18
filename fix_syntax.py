import re

with open("src/ImmigrationMVP.jsx", "r") as f:
    content = f.read()

# Fix 1
content = content.replace("""        const updatedUser = {
          ...latestUser,
          paidGenerationsRemaining: newPaid
        };
        setUser(updatedUser);
      }
        userRef.current = updatedUser;
      }""", """        const updatedUser = {
          ...latestUser,
          paidGenerationsRemaining: newPaid
        };
        setUser(updatedUser);
        userRef.current = updatedUser;
      }""")

with open("src/ImmigrationMVP.jsx", "w") as f:
    f.write(content)
